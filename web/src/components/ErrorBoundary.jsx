import * as React from "react";
import { Trans, withTranslation } from "react-i18next";
import { AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { copyToClipboard } from "../app/utils";
import Button from "./ui/Button";

const ExternalLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
    {children}
  </a>
);

const linkComponents = (issuesUrl) => ({
  githubLink: <ExternalLink href={issuesUrl} />,
  discordLink: <ExternalLink href="https://discord.gg/cT7ECsZj9w" />,
  matrixLink: <ExternalLink href="https://matrix.to/#/#ntfy:matrix.org" />,
});

class ErrorBoundaryImpl extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: false,
      stack: null,
      unsupportedIndexedDB: false,
    };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Error caught", error, info);

    // IndexedDB is unavailable in some private browsing modes (Firefox, Safari), see
    // - https://github.com/dexie/Dexie.js/issues/312
    // - https://bugzilla.mozilla.org/show_bug.cgi?id=781982
    const isUnsupportedIndexedDB =
      error?.name === "InvalidStateError" || (error?.name === "DatabaseClosedError" && error?.message?.indexOf("InvalidStateError") !== -1);

    if (isUnsupportedIndexedDB) {
      this.setState({ error: true, unsupportedIndexedDB: true });
    } else {
      this.handleError(error, info);
    }
  }

  handleError(error, info) {
    const componentStack = info.componentStack
      .trim()
      .split("\n")
      .map((line) => `  at ${line}`)
      .join("\n");
    const parts = [error.toString()];
    if (error.stack) parts.push(error.stack);
    parts.push(componentStack);
    this.setState({
      error: true,
      stack: parts.join("\n"),
    });
  }

  renderPage(title, description, extra) {
    return (
      <div className="min-h-dvh bg-bg px-4 py-10 text-text sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <AlertTriangle className="size-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 max-w-2xl text-muted">{description}</p>
          {extra}
        </div>
      </div>
    );
  }

  render() {
    const { t } = this.props;
    if (!this.state.error) {
      return this.props.children;
    }
    if (this.state.unsupportedIndexedDB) {
      return this.renderPage(
        t("error_boundary_unsupported_indexeddb_title"),
        <Trans
          i18nKey="error_boundary_unsupported_indexeddb_description"
          components={linkComponents("https://github.com/binwiederhier/ntfy/issues/208")}
        />,
      );
    }
    return this.renderPage(
      t("error_boundary_title"),
      <Trans i18nKey="error_boundary_description" components={linkComponents("https://github.com/linusr/ntfy/issues")} />,
      <>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => copyToClipboard(`${this.state.stack}\n`)}>
            <Copy className="size-4" />
            {t("error_boundary_button_copy_stack_trace")}
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" />
            {t("error_boundary_button_reload_ntfy")}
          </Button>
        </div>
        <h2 className="mt-8 text-sm font-semibold">{t("error_boundary_stack_trace")}</h2>
        <pre className="mt-2 max-h-[50dvh] overflow-auto rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-muted">
          {this.state.stack}
        </pre>
      </>,
    );
  }
}

const ErrorBoundary = withTranslation()(ErrorBoundaryImpl);
export default ErrorBoundary;
