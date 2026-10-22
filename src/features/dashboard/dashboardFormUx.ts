/** Reveal fields before native browser validation tries to focus them. */
export function revealDashboardField(element: Element) {
  let parent = element.parentElement;
  while (parent) {
    if (parent.tagName === "DETAILS")
      (parent as HTMLDetailsElement).open = true;
    parent = parent.parentElement;
  }
}

export function prepareDashboardFields(root: HTMLElement, prefix: string) {
  let sequence = 0;
  root
    .querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("input,select,textarea")
    .forEach((control) => {
      if (
        control instanceof HTMLInputElement &&
        control.type === "number" &&
        !control.hasAttribute("inputmode")
      )
        control.inputMode =
          !control.step || Number.isInteger(Number(control.step))
            ? "numeric"
            : "decimal";
      // Legacy forms place a label immediately before its input. Give those
      // labels a real association without altering submitted names or values.
      const label = control.previousElementSibling;
      if (
        label?.tagName === "LABEL" &&
        !label.hasAttribute("for") &&
        !label.querySelector("input,select,textarea")
      ) {
        if (!control.id) {
          do {
            control.id = `${prefix}-${++sequence}`;
          } while (
            root.ownerDocument.querySelectorAll(`[id="${control.id}"]`).length >
            1
          );
        }
        label.setAttribute("for", control.id);
      }
    });
  root
    .querySelectorAll<HTMLElement>('[role="alert"], [aria-invalid="true"]')
    .forEach((element) => {
      if (
        element.getAttribute("aria-invalid") === "true" ||
        element.textContent?.trim()
      )
        revealDashboardField(element);
    });
}
