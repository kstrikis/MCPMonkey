function isValidCSSProperty(property) {
    // Comprehensive whitelist of commonly used and important CSS properties
    const validProperties = [
        // Layout
        "display", "position", "top", "right", "bottom", "left", "float", "clear",
        "width", "height", "min-width", "max-width", "min-height", "max-height",
        "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
        "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
        
        // Box model
        "border", "border-width", "border-style", "border-color",
        "border-top", "border-right", "border-bottom", "border-left",
        "border-radius", "box-shadow", "box-sizing", "outline",
        
        // Typography
        "color", "font-family", "font-size", "font-weight", "font-style",
        "line-height", "letter-spacing", "text-align", "text-decoration",
        "text-transform", "white-space", "word-break", "word-wrap",
        
        // Visual
        "background", "background-color", "background-image",
        "background-position", "background-repeat", "background-size",
        "opacity", "visibility", "z-index", "overflow", "overflow-x", "overflow-y",
        
        // Flexbox
        "flex", "flex-basis", "flex-direction", "flex-flow", "flex-grow",
        "flex-shrink", "flex-wrap", "justify-content", "align-items",
        "align-content", "align-self", "order",
        
        // Grid
        "grid", "grid-template-columns", "grid-template-rows",
        "grid-template-areas", "grid-area", "grid-column", "grid-row",
        "gap", "grid-gap", "grid-column-gap", "grid-row-gap",
        
        // Transforms & Transitions
        "transform", "transform-origin", "transition", "transition-property",
        "transition-duration", "transition-timing-function", "transition-delay",
        
        // Animation
        "animation", "animation-name", "animation-duration",
        "animation-timing-function", "animation-delay", "animation-iteration-count",
        "animation-direction", "animation-fill-mode", "animation-play-state",
        
        // Pseudo-elements
        "content",
        
        // Misc
        "cursor", "pointer-events", "user-select"
    ];
    
    // Remove vendor prefixes and check the standardized property
    const standardProperty = property.replace(/^-(webkit|moz|ms|o)-/, '');
    return validProperties.includes(standardProperty);
}

function isValidCSSValue(property, value) {
    if (!value || value === 'initial' || value === 'inherit' || value === 'unset') return true;
    
    // Helper function to check numeric values with units
    const isValidNumericValue = (val) => {
        return typeof val === 'string' && (
            val === 'auto' ||
            val === '0' ||
            /^-?\d*\.?\d+(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)$/.test(val) ||
            /^calc\(.+\)$/.test(val)
        );
    };
    
    // Helper function to check color values
    const isValidColor = (val) => {
        return typeof val === 'string' && (
            val === 'transparent' ||
            val === 'currentColor' ||
            /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(val) ||
            /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(val) ||
            /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-1]?\.?\d+\s*\)$/.test(val) ||
            /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/.test(val) ||
            /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[0-1]?\.?\d+\s*\)$/.test(val)
        );
    };

    // Normalize the property name
    const normalizedProp = property.toLowerCase();
    
    switch (true) {
        // Dimensions and positions
        case /^(width|height|top|right|bottom|left|margin|padding|min-|max-)/i.test(normalizedProp):
            return isValidNumericValue(value);
            
        // Colors
        case /color$|background(-color)?$|border(-color)?$/i.test(normalizedProp):
            if (value === 'none') return 'transparent';
            return isValidColor(value);
            
        // Display
        case normalizedProp === 'display':
            return [
                'none', 'block', 'inline', 'inline-block', 'flex', 'inline-flex',
                'grid', 'inline-grid', 'table', 'table-cell', 'contents'
            ].includes(value);
            
        // Position
        case normalizedProp === 'position':
            return ['static', 'relative', 'absolute', 'fixed', 'sticky'].includes(value);
            
        // Font weight
        case normalizedProp === 'font-weight':
            return ['normal', 'bold', 'lighter', 'bolder'].includes(value) ||
                   (Number(value) >= 100 && Number(value) <= 900 && Number(value) % 100 === 0);
            
        // Opacity
        case normalizedProp === 'opacity':
            const num = parseFloat(value);
            return !isNaN(num) && num >= 0 && num <= 1;
            
        // Border style
        case /border(-.*)?-style$/i.test(normalizedProp):
            return ['none', 'hidden', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'].includes(value);
            
        // Text align
        case normalizedProp === 'text-align':
            return ['left', 'right', 'center', 'justify'].includes(value);
            
        // Overflow
        case /^overflow(-[xy])?$/i.test(normalizedProp):
            return ['visible', 'hidden', 'scroll', 'auto'].includes(value);
            
        // Visibility
        case normalizedProp === 'visibility':
            return ['visible', 'hidden', 'collapse'].includes(value);
            
        // Z-index
        case normalizedProp === 'z-index':
            return value === 'auto' || !isNaN(parseInt(value, 10));
            
        // Transform
        case normalizedProp === 'transform':
            return value === 'none' || /^(matrix|translate|scale|rotate|skew)/.test(value);
            
        // Flex properties
        case /^flex-/i.test(normalizedProp):
            if (normalizedProp === 'flex-direction') {
                return ['row', 'row-reverse', 'column', 'column-reverse'].includes(value);
            }
            if (normalizedProp === 'flex-wrap') {
                return ['nowrap', 'wrap', 'wrap-reverse'].includes(value);
            }
            return true; // Other flex properties have complex validation
            
        // Default case
        default:
            return true; // Accept unknown properties but log them
    }
}

function getComputedStyles(element) {
    const computed = window.getComputedStyle(element);
    const styles = {};

    for (let i = 0; i < computed.length; i++) {
        const property = computed[i];
        const value = computed.getPropertyValue(property);

        // 1. Whitelist check
        if (!isValidCSSProperty(property)) {
            continue;
        }

        // 2. Value validation
        const validatedValue = isValidCSSValue(property, value);
        if (!validatedValue) {
            console.warn(`Invalid value for ${property}: ${value}`);
            continue; // Skip invalid values
        }
        // Use validated value (which might have been corrected, like "none" -> "transparent")
        const finalValue = typeof validatedValue === "string" ? validatedValue : value;


        // 3. Handle -moz- prefixes (and other vendor prefixes if needed)
        if (property.startsWith("-moz-")) {
            const standardProperty = property.replace(/^-moz-/, "");
            if (computed.getPropertyValue(standardProperty)) {
                // Standard property exists, ignore the prefixed one
                continue;
            } else {
                // Add the standard property
              if(isValidCSSProperty(standardProperty)){
                styles[standardProperty] = finalValue;
              }
              continue;
            }
        }

        styles[property] = finalValue;
    }

    return styles;
}

function processStylesheetRules(sheet, allStyles) {
    try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach(rule => {
            if (rule instanceof CSSStyleRule) {
                // Store only global styles that have !important or are critical selectors
                const isCriticalSelector = rule.selectorText.includes('#') || // ID selectors
                                         /^[a-z]+$/i.test(rule.selectorText) || // Element selectors
                                         rule.selectorText.startsWith('.') || // Class selectors
                                         rule.selectorText.includes('[data-'); // Data attribute selectors
                
                if (rule.style.cssText.includes('!important') || isCriticalSelector) {
                    // Clean up the rule by removing vendor prefixes and invalid properties
                    const cleanedStyles = {};
                    for (let i = 0; i < rule.style.length; i++) {
                        const prop = rule.style[i];
                        const value = rule.style.getPropertyValue(prop);
                        
                        // Skip vendor prefixed properties if standard exists
                        if (prop.startsWith('-')) {
                            const standardProp = prop.replace(/^-(webkit|moz|ms|o)-/, '');
                            if (rule.style.getPropertyValue(standardProp)) continue;
                        }
                        
                        // Validate property and value
                        if (isValidCSSProperty(prop)) {
                            const validatedValue = isValidCSSValue(prop, value);
                            if (validatedValue !== false) {
                                cleanedStyles[prop] = typeof validatedValue === 'string' ? validatedValue : value;
                            }
                        }
                    }
                    
                    // Only add if we have valid styles
                    if (Object.keys(cleanedStyles).length > 0) {
                        allStyles.importantRules[rule.selectorText] = cleanedStyles;
                    }
                }
            } else if (rule instanceof CSSMediaRule) {
                // Clean up media query
                const query = rule.conditionText.replace(/\s*and\s*/g, ' and ')
                                              .replace(/-webkit-|-moz-|-ms-|-o-/g, '')
                                              .trim();
                
                // Process and deduplicate rules within the media query
                const mediaRules = Array.from(rule.cssRules).map(r => {
                    if (r instanceof CSSStyleRule) {
                        const cleanedStyles = {};
                        for (let i = 0; i < r.style.length; i++) {
                            const prop = r.style[i];
                            const value = r.style.getPropertyValue(prop);
                            
                            if (isValidCSSProperty(prop)) {
                                const validatedValue = isValidCSSValue(prop, value);
                                if (validatedValue !== false) {
                                    cleanedStyles[prop] = typeof validatedValue === 'string' ? validatedValue : value;
                                }
                            }
                        }
                        
                        return Object.keys(cleanedStyles).length > 0 ? {
                            selector: r.selectorText,
                            styles: cleanedStyles
                        } : null;
                    }
                    return null;
                }).filter(Boolean);
                
                if (mediaRules.length > 0) {
                    addMediaQueryRule(query, mediaRules);
                }
            } else if (rule instanceof CSSKeyframesRule) {
                // Only store keyframe animations that are actually used
                const isUsed = document.querySelector(`[style*="animation-name: ${rule.name}"]`) ||
                             document.querySelector(`[style*="animation: ${rule.name}"]`);
                
                if (isUsed) {
                    allStyles.animations[rule.name] = {
                        name: rule.name,
                        keyframes: Array.from(rule.cssRules).map(kf => ({
                            keyText: kf.keyText,
                            style: Object.fromEntries(
                                Array.from(kf.style).filter(prop => isValidCSSProperty(prop))
                                    .map(prop => [prop, kf.style.getPropertyValue(prop)])
                            )
                        }))
                    };
                }
            }
        });
    } catch (e) {
        console.warn('Error processing stylesheet rules:', e);
    }
}

function processElement(element, selector) {
    const computedStyles = getComputedStyles(element);
    
    // Skip elements with no meaningful styles
    if (Object.keys(computedStyles).length === 0) {
        return;
    }
    
    // Check if this element's styles are just inherited
    let hasNonInheritedStyles = false;
    if (element.parentElement) {
        const parentComputedStyle = window.getComputedStyle(element.parentElement);
        hasNonInheritedStyles = Object.entries(computedStyles).some(([prop, value]) => {
            const parentValue = parentComputedStyle.getPropertyValue(prop);
            if (prop === 'font-size') {
                // Handle relative font sizes
                if (value.endsWith('em') || value.endsWith('rem') || value.endsWith('%')) {
                    const parentSize = parseFloat(parentComputedStyle.fontSize);
                    let childSize;
                    if (value.endsWith('em')) {
                        childSize = parseFloat(value) * parentSize;
                    } else if (value.endsWith('rem')) {
                        const rootSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
                        childSize = parseFloat(value) * rootSize;
                    } else if (value.endsWith('%')) {
                        childSize = (parseFloat(value) / 100) * parentSize;
                    }
                    return Math.abs(childSize - parentSize) > 0.1; // Allow for small rounding differences
                }
            }
            return value !== parentValue;
        });
    } else {
        hasNonInheritedStyles = true; // Root elements always included
    }
    
    if (hasNonInheritedStyles) {
        data.styles.computedStyles[selector] = computedStyles;
    }
    
    // Handle pseudo-elements more efficiently
    ["::before", "::after"].forEach(pseudo => {
        const pseudoStyles = getComputedStyles(element, pseudo);
        // Only process if there's meaningful content and styles
        if (pseudoStyles.content &&
            pseudoStyles.content !== "none" &&
            pseudoStyles.content !== '""' &&
            pseudoStyles.content !== "-moz-alt-content") {
            
            // Remove properties that match the parent element's styles
            const uniqueStyles = {};
            Object.entries(pseudoStyles).forEach(([prop, value]) => {
                if (prop !== 'content' && computedStyles[prop] !== value) {
                    uniqueStyles[prop] = value;
                }
            });
            
            // Only add if we have styles beyond just 'content'
            if (Object.keys(uniqueStyles).length > 0) {
                uniqueStyles.content = pseudoStyles.content;
                data.styles.computedStyles[`${selector}${pseudo}`] = uniqueStyles;
            }
        }
    });
}

// Media Query Handling (Deduplication and Optimization)
function addMediaQueryRule(query, rules) {
    // Normalize media query
    query = query.toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/0px/g, '0')
                .replace(/\s*:\s*/g, ':')
                .trim();
    
    // Find existing media query or create new one
    let existingMediaQuery = data.styles.mediaQueries.find(mq => mq.query === query);
    if (existingMediaQuery) {
        // Merge rules, avoiding duplicates
        rules.forEach(newRule => {
            const existingRule = existingMediaQuery.rules.find(r => 
                r.selector === newRule.selector
            );
            if (existingRule) {
                // Merge styles
                Object.assign(existingRule.styles, newRule.styles);
            } else {
                existingMediaQuery.rules.push(newRule);
            }
        });
    } else {
        data.styles.mediaQueries.push({ query, rules });
    }
}

// Example of how to use addMediaQueryRule (inside your CSS parsing logic):
// ...
// if (rule.type === CSSRule.MEDIA_RULE) {
//     addMediaQueryRule(rule.conditionText, rule.cssText);
// }
// ...

// ... (rest of your userscript) 

async function getRealPageStyling() {
    try {
        const allStyles = {
            computedStyles: {},      // Essential computed styles (non-inherited)
            pseudoElements: {},      // Pseudo-element styles with actual content
            animations: {},          // Only used keyframe animations
            colorScheme: {},         // Color theme information
            typography: {},          // Typography system
            mediaQueries: [],        // Deduplicated and normalized media queries
            importantRules: {},      // Critical and !important rules
            customProperties: {},     // CSS variables in use
            layoutInfo: {},          // Layout structure
            errors: [],              // Error tracking
            metadata: {              // New metadata section
                extractedAt: Date.now(),
                url: window.location.href,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                userAgent: navigator.userAgent
            }
        };

        // Track timing for performance monitoring
        const timing = {
            start: performance.now(),
            phases: {}
        };

        // Process stylesheets first
        const styleSheets = Array.from(document.styleSheets);
        const externalSheetPromises = [];
        
        // Process internal and external sheets separately
        styleSheets.forEach((sheet, sheetIndex) => {
            try {
                if (sheet.href) {
                    // External stylesheet
                    externalSheetPromises.push(
                        processExternalStylesheet(sheet.href, allStyles, sheetIndex)
                            .catch(error => {
                                allStyles.errors.push({
                                    type: 'external_stylesheet',
                                    href: sheet.href,
                                    message: error.message
                                });
                            })
                    );
                } else {
                    // Internal stylesheet
                    try {
                        processStylesheetRules(sheet, allStyles);
                    } catch (e) {
                        if (e.name === 'SecurityError') {
                            allStyles.errors.push({
                                type: 'security_error',
                                message: 'CORS restriction on stylesheet',
                                href: sheet.href
                            });
                        } else {
                            allStyles.errors.push({
                                type: 'stylesheet_processing',
                                message: e.message,
                                href: sheet.href
                            });
                        }
                    }
                }
            } catch (e) {
                allStyles.errors.push({
                    type: 'stylesheet_access',
                    message: e.message,
                    href: sheet.href
                });
            }
        });

        // Wait for all external stylesheets
        await Promise.all(externalSheetPromises);
        timing.phases.stylesheets = performance.now() - timing.start;

        // Process elements in batches to avoid blocking the main thread
        const allElements = document.querySelectorAll('*');
        const batchSize = 100;
        const totalElements = allElements.length;
        
        for (let i = 0; i < totalElements; i += batchSize) {
            const batch = Array.from(allElements).slice(i, i + batchSize);
            
            // Process batch
            batch.forEach(element => {
                try {
                    processElement(element, getElementIdentifier(element));
                } catch (e) {
                    allStyles.errors.push({
                        type: 'element_processing',
                        message: e.message,
                        element: getElementIdentifier(element)
                    });
                }
            });
            
            // Allow other tasks to run
            if (i + batchSize < totalElements) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        timing.phases.elements = performance.now() - timing.phases.stylesheets - timing.start;

        // Extract theme information
        try {
            extractColorScheme(allStyles);
            extractTypography(allStyles);
            extractLayoutInfo(allStyles);
            extractCustomProperties(allStyles);
        } catch (e) {
            allStyles.errors.push({
                type: 'theme_extraction',
                message: e.message
            });
        }
        timing.phases.theme = performance.now() - timing.phases.elements - timing.phases.stylesheets - timing.start;

        // Clean up and optimize the output
        try {
            // Remove empty objects
            Object.keys(allStyles).forEach(key => {
                if (typeof allStyles[key] === 'object' && !Array.isArray(allStyles[key]) && Object.keys(allStyles[key]).length === 0) {
                    delete allStyles[key];
                }
            });

            // Deduplicate media queries one final time
            allStyles.mediaQueries = allStyles.mediaQueries.reduce((acc, mq) => {
                const existing = acc.find(x => x.query === mq.query);
                if (existing) {
                    // Merge rules
                    mq.rules.forEach(rule => {
                        const existingRule = existing.rules.find(r => r.selector === rule.selector);
                        if (existingRule) {
                            Object.assign(existingRule.styles, rule.styles);
                        } else {
                            existing.rules.push(rule);
                        }
                    });
                    return acc;
                }
                return [...acc, mq];
            }, []);

            // Add performance timing information
            timing.total = performance.now() - timing.start;
            allStyles.metadata.performance = timing;

        } catch (e) {
            allStyles.errors.push({
                type: 'optimization',
                message: e.message
            });
        }

        return allStyles;
    } catch (error) {
        console.error('Fatal error extracting page styles:', error);
        throw {
            error: error.message,
            type: 'fatal_error',
            timestamp: Date.now()
        };
    }
} 