// ==UserScript==
// @name         Page Style Extractor
// @namespace    https://github.com/kstrikis/MCPMonkey
// @version      0.1
// @description  Extract complete styling information from a webpage for AI-based cloning
// @author       MCPMonkey
// @match        *://*/*
// @grant        GM_addStyle
// @grant        unsafeWindow
// @require      https://unpkg.com/webextension-polyfill@0.12.0/dist/browser-polyfill.js
// ==/UserScript==

/**
 * Data structure for storing page style information
 * @typedef {Object} PageStyleInfo
 * @property {Object} globalStyles - Global styles from stylesheets
 * @property {Object[]} elementStyles - Array of element-specific styles
 * @property {Object} computedStyles - Computed styles for key elements
 * @property {Object} layoutInfo - Layout and positioning information
 * @property {Object} colorScheme - Color palette and theme information
 * @property {Object} typography - Font families and text styling
 * @property {Object} mediaQueries - Responsive design breakpoints
 */

/**
 * Message structure for communication
 * @typedef {Object} StyleMessage
 * @property {string} command - Command type ('getStyles' | 'styleData')
 * @property {PageStyleInfo} [data] - Style data when sending results
 * @property {string} [error] - Error message if something goes wrong
 */

(function() {
    'use strict';

    // Initialize browser runtime connection
    let port = browser.runtime.connect({ name: 'pageStyleExtractor' });

    /**
     * Extract all relevant styling information from the current page
     * @returns {PageStyleInfo}
     */
    function getPageStyling() {
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

    // Listen for messages from the extension
    port.onMessage.addListener((message) => {
        if (message.command === 'getStyles') {
            try {
                const styleData = getPageStyling();
                port.postMessage({
                    command: 'styleData',
                    data: styleData
                });
            } catch (error) {
                port.postMessage({
                    command: 'styleData',
                    error: error.message
                });
            }
        } else if (message.command === 'testAck') {
            console.log('Received test acknowledgment from browser:', message.data);
            console.log('Round trip time:', message.data.ackTimestamp - message.data.receivedTimestamp, 'ms');
        }
    });

    // Run test after a short delay
    setTimeout(() => {
        console.log('Running page style extractor test...');
        try {
            // Test style extraction
            const testData = getPageStyling();
            console.log('Test style extraction successful:', testData);

            // Test messaging
            console.log('Testing message communication with browser...');
            port.postMessage({
                command: 'testMessage',
                data: {
                    timestamp: Date.now(),
                    message: 'This is a test message from the userscript'
                }
            });
        } catch (error) {
            console.error('Test failed:', error);
        }
    }, 1500);

})(); 