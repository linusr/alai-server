//go:build !noapns

package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"heckel.io/ntfy/v2/apns"
	"heckel.io/ntfy/v2/db"
	"heckel.io/ntfy/v2/log"
	"heckel.io/ntfy/v2/metrics"
	"heckel.io/ntfy/v2/model"
	"heckel.io/ntfy/v2/user"
)

const (
	// APNSAvailable is false in builds with the 'noapns' tag.
	APNSAvailable = true

	apnsTopicSubscribeLimit = 100
	apnsPayloadLimit        = 4096 // Apple rejects larger alert payloads with PayloadTooLarge
	apnsPreviewTitleLimit   = 128
	apnsPreviewBodyLimit    = 512
	apnsCollapseIDLimit     = 64
	apnsDefaultPriority     = 3
	apnsMaxPriority         = 5
	apnsMinimalBody         = "New message"
	apnsBinaryBody          = "Binary message"
)

var apnsDeviceTokenRegex = regexp.MustCompile(`^[0-9a-fA-F]{64,200}$`)

// apnsSender delivers a single notification to APNs. In tests, this can be implemented with a mock.
type apnsSender interface {
	Send(ctx context.Context, n *apns.Notification) error
}

// apnsPayload is the JSON body of an APNs request. The "ntfy" key carries the message in the
// same format as the JSON subscribe API, so the app can decode it with the same model.
type apnsPayload struct {
	APS     apnsAPS        `json:"aps"`
	BaseURL string         `json:"base_url"`
	Message *model.Message `json:"ntfy"`
}

type apnsAPS struct {
	Alert             *apnsAlert `json:"alert,omitempty"`
	Sound             string     `json:"sound,omitempty"`
	ThreadID          string     `json:"thread-id,omitempty"`
	MutableContent    int        `json:"mutable-content,omitempty"`
	ContentAvailable  int        `json:"content-available,omitempty"`
	InterruptionLevel string     `json:"interruption-level,omitempty"`
	RelevanceScore    float64    `json:"relevance-score,omitempty"`
}

type apnsAlert struct {
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
}

// apnsContentMode selects how much of a message travels through APNs.
type apnsContentMode int

const (
	apnsContentFull    apnsContentMode = iota // Full message, the app displays it as-is
	apnsContentPreview                        // Truncated alert text, the app fetches the full message by ID
	apnsContentMinimal                        // Generic alert text, the app fetches the message by ID
)

func createAPNS(conf *Config, pool *db.DB) (*apns.Store, apnsSender, error) {
	if conf.APNSKeyFile == "" {
		return nil, nil, nil
	}
	client, err := apns.NewClientFromKeyFile(conf.APNSKeyFile, conf.APNSKeyID, conf.APNSTeamID, conf.APNSBundleID)
	if err != nil {
		return nil, nil, err
	}
	var store *apns.Store
	if pool != nil {
		store, err = apns.NewPostgresStore(pool)
	} else {
		store, err = apns.NewSQLiteStore(conf.APNSFile, conf.APNSStartupQueries)
	}
	if err != nil {
		return nil, nil, err
	}
	return store, client, nil
}

func (s *Server) handleAPNSDeviceUpdate(w http.ResponseWriter, r *http.Request, v *visitor) error {
	req, err := readJSONWithLimit[apiAPNSDeviceRequest](r.Body, jsonBodyBytesLimit, false)
	if err != nil || !apnsDeviceTokenRegex.MatchString(req.Token) {
		return errHTTPBadRequestAPNSDeviceInvalid
	}
	environment := req.Environment
	if environment == "" {
		environment = apns.EnvironmentProduction
	} else if environment != apns.EnvironmentProduction && environment != apns.EnvironmentSandbox {
		return errHTTPBadRequestAPNSDeviceInvalid
	}
	if len(req.Topics) > apnsTopicSubscribeLimit {
		return errHTTPBadRequestAPNSTopicCountTooHigh
	}
	topics, err := s.topicsFromIDs(v, req.Topics...)
	if err != nil {
		return err
	}
	if s.userManager != nil {
		u := v.User()
		for _, t := range topics {
			if err := s.userManager.Authorize(u, t.ID, user.PermissionRead); err != nil {
				logvr(v, r).With(t).Err(err).Debug("Access to topic %s not authorized", t.ID)
				return errHTTPForbidden.With(t)
			}
		}
	}
	token := strings.ToLower(req.Token)
	if err := s.apnsStore.UpsertDevice(token, environment, v.MaybeUserID(), v.IP(), req.Topics); errors.Is(err, apns.ErrAPNSTooManyDevices) {
		return errHTTPTooManyRequestsLimitRequests
	} else if err != nil {
		return err
	}
	return s.writeJSON(w, newSuccessResponse())
}

func (s *Server) handleAPNSDeviceDelete(w http.ResponseWriter, r *http.Request, _ *visitor) error {
	req, err := readJSONWithLimit[apiAPNSDeviceRequest](r.Body, jsonBodyBytesLimit, false)
	if err != nil || !apnsDeviceTokenRegex.MatchString(req.Token) {
		return errHTTPBadRequestAPNSDeviceInvalid
	}
	if err := s.apnsStore.RemoveDeviceByToken(strings.ToLower(req.Token)); err != nil {
		return err
	}
	return s.writeJSON(w, newSuccessResponse())
}

func (s *Server) publishToAPNSDevices(v *visitor, m *model.Message) {
	devices, err := s.apnsStore.DevicesForTopic(m.Topic)
	if err != nil {
		logvm(v, m).Tag(tagAPNS).Err(err).Warn("Unable to read APNs devices")
		return
	}
	devices = s.authorizedAPNSDevices(m.Topic, devices)
	if len(devices) == 0 {
		return
	}
	template, err := toAPNSNotification(m, s.config.BaseURL, s.config.APNSPayload)
	if err != nil {
		logvm(v, m).Tag(tagAPNS).Err(err).Warn("Unable to build APNs notification")
		return
	} else if template == nil {
		return
	}
	logvm(v, m).Tag(tagAPNS).Debug("Publishing to %d APNs device(s)", len(devices))
	for _, device := range devices {
		n := *template
		n.Token = device.Token
		n.Environment = device.Environment
		err := s.apnsSender.Send(context.Background(), &n)
		if err == nil {
			metrics.APNSPublishedSuccess.Inc()
			continue
		}
		metrics.APNSPublishedFailure.Inc()
		var apnsErr *apns.Error
		if errors.As(err, &apnsErr) && apnsErr.Unregistered() {
			ev := logvm(v, m).Tag(tagAPNS).With(device).Err(err)
			if apnsErr.Misconfigured() {
				ev.Warn("APNs rejected device token, removing device; check apns-bundle-id and the app's build environment")
			} else {
				ev.Debug("APNs device token no longer valid, removing device")
			}
			if err := s.apnsStore.RemoveDeviceByToken(device.Token); err != nil {
				logvm(v, m).Tag(tagAPNS).With(device).Err(err).Warn("Unable to remove APNs device")
			}
			continue
		}
		logvm(v, m).Tag(tagAPNS).With(device).Err(err).Warn("Unable to publish to APNs")
	}
}

// authorizedAPNSDevices drops devices whose registering user no longer has read access to the
// topic; registration only checks permissions at the time the device registers.
func (s *Server) authorizedAPNSDevices(topic string, devices []*apns.Device) []*apns.Device {
	if s.userManager == nil {
		return devices
	}
	allowed := make(map[string]bool)
	authorized := make([]*apns.Device, 0, len(devices))
	for _, device := range devices {
		ok, checked := allowed[device.UserID]
		if !checked {
			ok = s.apnsUserCanRead(device.UserID, topic)
			allowed[device.UserID] = ok
		}
		if ok {
			authorized = append(authorized, device)
		}
	}
	return authorized
}

func (s *Server) apnsUserCanRead(userID, topic string) bool {
	var u *user.User
	if userID != "" {
		var err error
		if u, err = s.userManager.UserByID(userID); err != nil {
			return false
		}
	}
	return s.userManager.Authorize(u, topic, user.PermissionRead) == nil
}

func (s *Server) pruneAPNSDevices() {
	if s.apnsStore == nil {
		return
	}
	go func() {
		if err := s.apnsStore.RemoveExpiredDevices(s.config.APNSExpiryDuration); err != nil {
			log.Tag(tagAPNS).Err(err).Warn("Unable to prune APNs devices")
		}
	}()
}

// toAPNSNotification builds the device-independent part of an APNs request for a message, or
// returns nil if the event is not delivered to iOS devices.
func toAPNSNotification(m *model.Message, baseURL, payloadMode string) (*apns.Notification, error) {
	var n *apns.Notification
	var err error
	switch m.Event {
	case model.MessageEvent:
		n, err = toAPNSAlertNotification(m, baseURL, payloadMode)
	case model.MessageDeleteEvent, model.MessageClearEvent:
		n, err = toAPNSBackgroundNotification(m, baseURL)
	default:
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if m.Expires > 0 {
		n.Expiration = time.Unix(m.Expires, 0)
	}
	return n, nil
}

func toAPNSAlertNotification(m *model.Message, baseURL, payloadMode string) (*apns.Notification, error) {
	mode := apnsContentFull
	if payloadMode == APNSPayloadMinimal {
		mode = apnsContentMinimal
	}
	payload, err := json.Marshal(newAPNSAlertPayload(m, baseURL, mode))
	if err != nil {
		return nil, err
	}
	if len(payload) > apnsPayloadLimit {
		if payload, err = json.Marshal(newAPNSAlertPayload(m, baseURL, apnsContentPreview)); err != nil {
			return nil, err
		}
	}
	priority := apns.PriorityImmediate
	if apnsInterruptionLevel(m.Priority) == "passive" {
		priority = apns.PriorityPowerConsiderate
	}
	return &apns.Notification{
		PushType:   apns.PushTypeAlert,
		Priority:   priority,
		CollapseID: apnsCollapseID(m),
		Payload:    payload,
	}, nil
}

// toAPNSBackgroundNotification wakes the app to withdraw delivered notifications for a deleted
// or cleared message. Apple throttles background pushes, so delivery is best-effort.
func toAPNSBackgroundNotification(m *model.Message, baseURL string) (*apns.Notification, error) {
	payload, err := json.Marshal(&apnsPayload{
		APS:     apnsAPS{ContentAvailable: 1},
		BaseURL: baseURL,
		Message: m.ForJSON(),
	})
	if err != nil {
		return nil, err
	}
	return &apns.Notification{
		PushType: apns.PushTypeBackground,
		Priority: apns.PriorityPowerConsiderate,
		Payload:  payload,
	}, nil
}

func newAPNSAlertPayload(m *model.Message, baseURL string, mode apnsContentMode) *apnsPayload {
	level := apnsInterruptionLevel(m.Priority)
	sound := "default"
	if level == "passive" {
		sound = ""
	}
	title, body, message := m.Title, m.Message, m.ForJSON()
	if title == "" {
		title = m.Topic
	}
	if m.Encoding == encodingBase64 {
		body = apnsBinaryBody
	}
	switch mode {
	case apnsContentPreview:
		title, body = truncateUTF8(title, apnsPreviewTitleLimit), truncateUTF8(body, apnsPreviewBodyLimit)
		message = toPollRequest(m)
	case apnsContentMinimal:
		title, body = m.Topic, apnsMinimalBody
		message = toPollRequest(m)
	}
	return &apnsPayload{
		APS: apnsAPS{
			Alert:             &apnsAlert{Title: title, Body: body},
			Sound:             sound,
			ThreadID:          m.Topic,
			MutableContent:    1,
			InterruptionLevel: level,
			RelevanceScore:    float64(apnsEffectivePriority(m.Priority)) / apnsMaxPriority,
		},
		BaseURL: baseURL,
		Message: message,
	}
}

// apnsInterruptionLevel maps ntfy priorities to iOS interruption levels. Priority 5 maps to
// time-sensitive rather than critical, since critical alerts require an entitlement from Apple.
func apnsInterruptionLevel(priority int) string {
	switch p := apnsEffectivePriority(priority); {
	case p <= 2:
		return "passive"
	case p == 3:
		return "active"
	default:
		return "time-sensitive"
	}
}

func apnsEffectivePriority(priority int) int {
	if priority == 0 {
		return apnsDefaultPriority
	}
	return priority
}

// apnsCollapseID makes an updated message (same sequence ID) replace its earlier notification.
func apnsCollapseID(m *model.Message) string {
	id := m.SequenceID
	if id == "" {
		id = m.ID
	}
	if len(id) > apnsCollapseIDLimit {
		return ""
	}
	return id
}

func truncateUTF8(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	cut := limit - len("…")
	for cut > 0 && !utf8.RuneStart(s[cut]) {
		cut--
	}
	return s[:cut] + "…"
}

// toPollRequest strips a message down to a poll request that carries only its ID, so the client
// fetches the full message from the server.
func toPollRequest(m *model.Message) *model.Message {
	pr := model.NewPollRequestMessage(m.Topic, m.ID)
	pr.ID = m.ID
	pr.Time = m.Time
	pr.Priority = m.Priority
	pr.ContentType = m.ContentType
	pr.Encoding = m.Encoding
	return pr
}
