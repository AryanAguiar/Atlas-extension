document.getElementById("goDashboard").addEventListener("click", () => {
  // open your dashboard in a new tab
  chrome.tabs.create({ url: " http://localhost:5173/" });
});

document.getElementById("toggleHighlight").addEventListener("click", async () => {
  // send a message to the content script to toggle highlights
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["contentScript.js"] // your highlighting code
  });
});
