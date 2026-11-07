/**
 * Opens the browser's print dialog (where the user can choose "Salvar como PDF") for a complete
 * HTML document, without leaving the page. The document is rendered in a hidden, sandboxed frame
 * that cannot run scripts; the page title is borrowed while printing because browsers suggest it
 * as the PDF file name.
 */
export function printHtmlDocument({ html, title }: { html: string; title: string }) {
  return new Promise<void>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      visibility: "hidden",
    });

    const pageTitle = document.title;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.title = pageTitle;
      window.removeEventListener("afterprint", finish);
      frame.remove();
    };

    frame.addEventListener(
      "load",
      () => {
        const printWindow = frame.contentWindow;
        if (!printWindow) {
          finish();
          reject(new Error("Print frame is not available"));
          return;
        }
        printWindow.addEventListener("afterprint", finish);
        window.addEventListener("afterprint", finish);
        document.title = title;
        try {
          printWindow.focus();
          printWindow.print();
          resolve();
        } catch (error) {
          finish();
          reject(error);
        }
      },
      { once: true },
    );

    frame.srcdoc = html;
    document.body.append(frame);
  });
}
