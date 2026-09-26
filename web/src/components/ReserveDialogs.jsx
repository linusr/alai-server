import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Trash2 } from "lucide-react";
import { validTopic } from "../app/utils";
import session from "../app/Session";
import routes from "./routes";
import accountApi, { Permission } from "../app/AccountApi";
import ReserveTopicSelect, { ChoiceList } from "./ReserveTopicSelect";
import { TopicReservedError, UnauthorizedError } from "../app/errors";
import { Dialog, DialogContent, DialogFooter } from "./ui/Dialog";
import { Field, Input } from "./ui/Field";
import Button from "./ui/Button";
import { Alert } from "./ui/Primitives";

const closeOnDismiss = (onClose) => (open) => !open && onClose();

export const DialogError = ({ error }) =>
  error ? (
    <p role="alert" className="mt-4 text-sm text-danger">
      {error}
    </p>
  ) : null;

export const ReserveAddDialog = (props) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [topic, setTopic] = useState(props.topic || "");
  const [everyone, setEveryone] = useState(Permission.DENY_ALL);
  const allowTopicEdit = !props.topic;
  const alreadyReserved = props.reservations.some((r) => r.topic === topic);
  const submitButtonEnabled = validTopic(topic) && !alreadyReserved;

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!submitButtonEnabled) {
      return;
    }
    try {
      await accountApi.upsertReservation(topic, everyone);
      console.debug(`[ReserveAddDialog] Added reservation for topic ${topic}: ${everyone}`);
    } catch (e) {
      console.log(`[ReserveAddDialog] Error adding topic reservation.`, e);
      if (e instanceof UnauthorizedError) {
        await session.resetAndRedirect(routes.login);
      } else if (e instanceof TopicReservedError) {
        setError(t("subscribe_dialog_error_topic_already_reserved"));
        return;
      } else {
        setError(e.message);
        return;
      }
    }
    props.onClose();
  };

  return (
    <Dialog open={props.open} onOpenChange={closeOnDismiss(props.onClose)}>
      <DialogContent title={t("prefs_reservations_dialog_title_add")} description={t("prefs_reservations_dialog_description")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {allowTopicEdit && (
            <Field label={t("prefs_reservations_dialog_topic_label")} htmlFor="reserve-topic">
              <Input id="reserve-topic" autoFocus value={topic} onChange={(ev) => setTopic(ev.target.value)} />
            </Field>
          )}
          <ReserveTopicSelect value={everyone} onChange={setEveryone} />
          <DialogError error={error} />
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={props.onClose}>
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={!submitButtonEnabled}>
              {t("common_add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const ReserveEditDialog = (props) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [everyone, setEveryone] = useState(props.reservation?.everyone || Permission.DENY_ALL);

  const handleSubmit = async () => {
    try {
      await accountApi.upsertReservation(props.reservation.topic, everyone);
      console.debug(`[ReserveEditDialog] Updated reservation for topic ${props.reservation.topic}: ${everyone}`);
    } catch (e) {
      console.log(`[ReserveEditDialog] Error updating topic reservation.`, e);
      if (e instanceof UnauthorizedError) {
        await session.resetAndRedirect(routes.login);
      } else {
        setError(e.message);
        return;
      }
    }
    props.onClose();
  };

  return (
    <Dialog open={props.open} onOpenChange={closeOnDismiss(props.onClose)}>
      <DialogContent title={t("prefs_reservations_dialog_title_edit")} description={t("prefs_reservations_dialog_description")}>
        <ReserveTopicSelect value={everyone} onChange={setEveryone} />
        <DialogError error={error} />
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleSubmit}>{t("common_save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ReserveDeleteDialog = (props) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [deleteMessages, setDeleteMessages] = useState(false);

  const handleSubmit = async () => {
    try {
      await accountApi.deleteReservation(props.topic, deleteMessages);
      console.debug(`[ReserveDeleteDialog] Deleted reservation for topic ${props.topic}`);
    } catch (e) {
      console.log(`[ReserveDeleteDialog] Error deleting topic reservation.`, e);
      if (e instanceof UnauthorizedError) {
        await session.resetAndRedirect(routes.login);
      } else {
        setError(e.message);
        return;
      }
    }
    props.onClose();
  };

  const options = [
    {
      value: false,
      icon: <Check className="size-4 shrink-0 text-muted" aria-hidden />,
      label: t("reservation_delete_dialog_action_keep_title"),
    },
    {
      value: true,
      icon: <Trash2 className="size-4 shrink-0 text-danger" aria-hidden />,
      label: t("reservation_delete_dialog_action_delete_title"),
    },
  ];

  return (
    <Dialog open={props.open} onOpenChange={closeOnDismiss(props.onClose)}>
      <DialogContent title={t("prefs_reservations_dialog_title_delete")} description={t("reservation_delete_dialog_description")}>
        <ChoiceList
          label={t("prefs_reservations_dialog_title_delete")}
          options={options}
          value={deleteMessages}
          onChange={setDeleteMessages}
        />
        <Alert severity={deleteMessages ? "warning" : "info"} className="mt-3">
          {deleteMessages
            ? t("reservation_delete_dialog_action_delete_description")
            : t("reservation_delete_dialog_action_keep_description")}
        </Alert>
        <DialogError error={error} />
        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            {t("common_cancel")}
          </Button>
          <Button variant="danger" onClick={handleSubmit}>
            {t("reservation_delete_dialog_submit_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
