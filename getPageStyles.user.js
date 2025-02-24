// ==UserScript==
// @name         Page Style Extractor
// @namespace    https://github.com/kstrikis/MCPMonkey
// @version      0.1
// @description  Extract complete styling information from a webpage for AI-based cloning
// @author       MCPMonkey
// @match        *://*/*
// @grant        unsafeWindow
// @grant        GM_info
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
        STYLE_REQUEST: 'MM_ext:styleRequest',
        STYLE_RESPONSE: 'MM_us:styleResponse'
    };

    // Track processed message IDs to prevent loops
    const processedMessages = new Set();

    /**
     * Generate a UUID v4
     * @returns {string} A random UUID
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Return sample styling information
     * @returns {Object} Sample page style information
     */
    function getPageStyling() {
        // Return sample data matching the expected schema
        return {
            globalStyles: {
                'body': 'body { margin: 0; padding: 0; }',
                'h1': 'h1 { font-size: 24px; }'
            },
            computedStyles: {
                body: {
                    'margin': '0px',
                    'padding': '0px',
                    'font-family': 'Arial, sans-serif'
                }
            },
            colorScheme: {
                backgroundColor: '#ffffff',
                textColor: '#000000',
                linkColor: '#0066cc'
            },
            typography: {
                fontFamily: 'Arial, sans-serif',
                fontSize: '16px',
                lineHeight: '1.5'
            },
            mediaQueries: [
                {
                    query: '(max-width: 768px)',
                    rules: ['body { font-size: 14px; }']
                }
            ]
        };
    }

    /**
     * Extract all relevant styling information from the current page
     * Currently disabled in favor of sample data
     * @returns {Object} The page style information
     */
    /*
    function getRealPageStyling() {
        try {
            // Get all stylesheets
            const styleSheets = Array.from(document.styleSheets);
            const globalStyles = {};
            
            // Process stylesheets safely (handling CORS restrictions)
            styleSheets.forEach(sheet => {
                try {
                    const rules = Array.from(sheet.cssRules || []);
                    rules.forEach(rule => {
                        if (rule.selectorText) {
                            globalStyles[rule.selectorText] = rule.cssText;
                        }
                    });
                } catch (e) {
                    // Skip CORS-restricted stylesheets
                    console.warn('Could not access stylesheet:', e);
                }
            });

            // Get computed styles for body and key elements
            const computedStyles = {
                body: window.getComputedStyle(document.body),
                html: window.getComputedStyle(document.documentElement)
            };

            // Extract color scheme
            const colorScheme = {
                backgroundColor: computedStyles.body.backgroundColor,
                textColor: computedStyles.body.color,
                linkColor: window.getComputedStyle(document.querySelector('a') || {}).color
            };

            // Extract typography
            const typography = {
                fontFamily: computedStyles.body.fontFamily,
                fontSize: computedStyles.body.fontSize,
                lineHeight: computedStyles.body.lineHeight
            };

            // Collect media queries
            const mediaQueries = styleSheets.flatMap(sheet => {
                try {
                    return Array.from(sheet.cssRules || [])
                        .filter(rule => rule instanceof CSSMediaRule)
                        .map(rule => ({
                            query: rule.conditionText,
                            rules: Array.from(rule.cssRules).map(r => r.cssText)
                        }));
                } catch (e) {
                    return [];
                }
            });

            return {
                globalStyles,
                computedStyles: {
                    body: Object.fromEntries(
                        Array.from(computedStyles.body)
                            .map(prop => [prop, computedStyles.body.getPropertyValue(prop)])
                    )
                },
                colorScheme,
                typography,
                mediaQueries
            };
        } catch (error) {
            console.error('Error extracting page styles:', error);
            throw error;
        }
    }
    */

    // Listen for messages from extension
    unsafeWindow.addEventListener('message', function(event) {
        // Only accept messages from our own window
        if (event.source !== unsafeWindow) return;
        
        const { type, data, messageId } = event.data;
        // Only handle messages from extension
        if (!type?.startsWith('MM_ext:')) return;
        
        // Skip if we've already processed this message
        if (messageId && processedMessages.has(messageId)) {
            return;
        }
        
        // Mark message as processed if it has an ID
        if (messageId) {
            processedMessages.add(messageId);
            // Cleanup old message IDs after 5 seconds
            setTimeout(() => processedMessages.delete(messageId), 5000);
        }
        
        console.log('Userscript received message:', { type, data, messageId });
        
        if (type === MESSAGE_TYPES.STYLE_REQUEST) {
            console.log('Processing style request');
            try {
                const styleData = getPageStyling();
                console.log('Generated style data:', styleData);
                
                const response = {
                    type: MESSAGE_TYPES.STYLE_RESPONSE,
                    messageId: generateUUID(),
                    data: {
                        styles: styleData,
                        timestamp: Date.now()
                    }
                };
                console.log('Sending response:', response);
                unsafeWindow.postMessage(response, '*');
            } catch (error) {
                console.error('Error processing style request:', error);
                unsafeWindow.postMessage({
                    type: MESSAGE_TYPES.STYLE_RESPONSE,
                    messageId: generateUUID(),
                    data: {
                        error: error.message,
                        timestamp: Date.now()
                    }
                }, '*');
            }
        }
    });

    console.log('Page Style Extractor initialized...');
})(); 