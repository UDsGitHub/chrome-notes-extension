import { PENDING_NOTE_KEY, CONTEXT_MENU_ID } from "./constants.js";

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Save to Notes",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (data, tab) => {
  if (data.menuItemId !== CONTEXT_MENU_ID || !tab || !tab.id) return;

  await chrome.storage.session.set({ [PENDING_NOTE_KEY]: data.selectionText });
  await chrome.sidePanel.open({ tabId: tab.id });
});
