module heckel.io/ntfy/v2

go 1.25.8

require (
	github.com/BurntSushi/toml v1.6.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.7 // indirect
	github.com/emersion/go-smtp v0.25.0
	github.com/gabriel-vasile/mimetype v1.4.15
	github.com/gorilla/websocket v1.5.3
	github.com/mattn/go-sqlite3 v1.14.50
	github.com/olebedev/when v1.1.0
	github.com/stretchr/testify v1.12.1
	github.com/urfave/cli/v2 v2.27.7
	golang.org/x/crypto v0.55.0
	golang.org/x/sync v0.22.0
	golang.org/x/term v0.45.0
	golang.org/x/time v0.15.0
	gopkg.in/yaml.v2 v2.4.0
)

replace github.com/emersion/go-smtp => github.com/emersion/go-smtp v0.17.0 // Pin version due to breaking changes, see #839

require github.com/pkg/errors v0.9.1 // indirect

require (
	github.com/SherClockHolmes/webpush-go v1.4.0
	github.com/golang-jwt/jwt/v5 v5.3.1
	github.com/jackc/pgx/v5 v5.10.0
	github.com/microcosm-cc/bluemonday v1.0.27
	github.com/prometheus/client_golang v1.24.1
	golang.org/x/sys v0.47.0
	golang.org/x/text v0.41.0
)

require (
	github.com/AlekSi/pointer v1.2.0 // indirect
	github.com/aymerick/douceur v0.2.0 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/emersion/go-sasl v0.0.0-20241020182733-b788ff22d5a6 // indirect
	github.com/gorilla/css v1.0.1 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/kr/pretty v0.3.1 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/prometheus/client_model v0.6.2 // indirect
	github.com/prometheus/common v0.70.1 // indirect
	github.com/prometheus/procfs v0.21.1 // indirect
	github.com/rogpeppe/go-internal v1.14.1 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/xrash/smetrics v0.0.0-20250705151800-55b8f293f342 // indirect
	go.yaml.in/yaml/v3 v3.0.5 // indirect
	golang.org/x/net v0.58.0 // indirect
	google.golang.org/protobuf v1.36.12 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
