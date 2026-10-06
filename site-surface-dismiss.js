export function createBackdropDismissGuard(backdrop) {
  let pointerDownTarget;

  return {
    notePointerDown(event) {
      pointerDownTarget = event?.target;
    },
    shouldDismiss(event) {
      const beganInsidePanel = pointerDownTarget && pointerDownTarget !== backdrop;
      pointerDownTarget = undefined;
      return event?.target === backdrop && !beganInsidePanel;
    },
  };
}
