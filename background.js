// Claims for highlighting
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "PROCESS_CHUNKS") {
        fetch("http://localhost:5000/api/claims/processChunks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: msg.url,
                chunks: msg.chunks
            })
        })
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => {
                console.error(err);
                sendResponse({ rawClaims: [], allClaims: [] });
            });

        return true; // keeps async channel alive
    }
});

// Claims for modal
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_VERIFIED_CLAIMS") {
        fetch("http://localhost:5000/api/claims/claimsWithVerification")
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => {
                console.error(err);
                sendResponse({ claims: [] });
            });

        return true;
    }
});
