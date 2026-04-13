export type ViewType = 'main' | 'search' | 'plugin-manager' | 'settings'

declare global {
  var __mqboxCurrentView: ViewType
}

global.__mqboxCurrentView = 'main'

export function setCurrentView(view: ViewType) {
  global.__mqboxCurrentView = view
}

export function getCurrentView(): ViewType {
  return global.__mqboxCurrentView
}