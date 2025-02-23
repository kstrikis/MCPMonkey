// ==UserScript==
// @name         Page Style Extractor
// @namespace    https://github.com/kstrikis/MCPMonkey
// @version      0.1
// @description  Extract complete styling information from a webpage for AI-based cloning
// @author       MCPMonkey
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_listValues
// @grant        GM_info
// @grant        unsafeWindow
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // Log environment info
    console.log('Userscript environment:', {
        scriptHandler: GM_info.scriptHandler,
        version: GM_info.version,
        injectInto: GM_info.injectInto,
        script: {
            name: GM_info.script.name,
            namespace: GM_info.script.namespace,
            description: GM_info.script.description,
            version: GM_info.script.version,
            grant: GM_info.script.grant
        }
    });

    // Message types for communication
    const MESSAGE_TYPES = {
        TEST_DATA: 'MCPMonkey:testData',
        TEST_RESPONSE: 'MCPMonkey:testResponse'
    };

    // Write initial test data
    const testData = {
        timestamp: Date.now(),
        message: 'Hello from userscript',
        counter: 0
    };
    
    // Listen for messages from extension
    unsafeWindow.addEventListener('message', function(event) {
        // Only accept messages from our own window
        if (event.source !== unsafeWindow) return;
        
        if (event.data.type === MESSAGE_TYPES.TEST_DATA) {
            console.log('Userscript received message:', event.data);
            
            // Send response back
            unsafeWindow.postMessage({
                type: MESSAGE_TYPES.TEST_RESPONSE,
                data: {
                    received: event.data,
                    response: testData
                }
            }, '*');
        }
    });

    // Try sending data several times
    let attempt = 0;
    const maxAttempts = 5;
    
    function sendTestData() {
        if (attempt >= maxAttempts) return;
        
        testData.counter = attempt + 1;
        
        // Send message to extension
        unsafeWindow.postMessage({
            type: MESSAGE_TYPES.TEST_DATA,
            data: testData
        }, '*');
        
        console.log('Userscript sent test data:', testData);
        
        attempt++;
        setTimeout(sendTestData, 1000);
    }

    // Start sending after a short delay
    setTimeout(sendTestData, 1000);
    
    console.log('Userscript test initialized...');
})(); 