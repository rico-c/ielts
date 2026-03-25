export const OPEN_DASHBOARD_PRICING_MODAL_EVENT =
  "dashboard:open-pricing-modal";

export function openDashboardPricingModal() {
  window.dispatchEvent(new Event(OPEN_DASHBOARD_PRICING_MODAL_EVENT));
}
