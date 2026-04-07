# NanoBrowser

See https://github.com/nanobrowser/nanobrowser !

All the following is deprecated!

# Browser Automation - Design Documentation

## Overview

Browser Automation is a Chrome extension that enables remote control of browser operations through WebSocket communication. It provides a bridge between a server application and the Chrome browser, allowing for comprehensive web automation capabilities including navigation, interaction, data extraction, and more.

## Architecture

### High-Level Components

1. **WebSocket Server** - External server that sends commands to the extension
2. **Background Service Worker** - Core extension component managing WebSocket connection and command routing
3. **Popup UI** - User interface for connection management
4. **Options Page** - Advanced configuration and logging interface
5. **Content Script Executor** - Injected script that performs DOM operations within web pages

### Component Responsibilities

#### Popup Module

- **Files**: `popup/popup.html`, `popup/popup.js`
- **Responsibilities**:
  - Display connection status to WebSocket server
  - Allow users to configure server URL
  - Enable connect/disconnect functionality
  - Provide visual feedback on extension state
  - **Request state from background** via message passing (no direct storage access)

#### Options Page Module

- **Files**: `options/options.html`, `options/options.js`
- **Responsibilities**:
  - Advanced configuration and settings management
  - Detailed logging and metrics visualization
  - Log management (view, filter, clear, export)
  - Performance monitoring and analytics dashboard
  - Data storage management with IndexDB/Dexie.js integration
  - Extended UI for complex automation workflows
  - **Request state from background** via message passing (no direct storage access)

#### Background Service Worker

- **File**: `background/service-worker.js`
- **Responsibilities**:
  - Maintain persistent WebSocket connection to server
  - Route commands between server and appropriate execution contexts
  - Execute browser-level operations (navigation, screenshots, etc.)
  - Manage tab lifecycle and content script injection
  - Implement connection keep-alive mechanisms using Chrome alarms
  - **Serve as centralized state manager** with exclusive `chrome.storage` access
  - **Coordinate state synchronization** between all extension components
  - **Handle all state-related messaging** (`GET_STATE`/`SET_STATE` requests)

#### Content Script Executor

- **File**: `content/executor.js`
- **Responsibilities**:
  - Execute DOM operations within web page context
  - Perform element interaction (clicks, typing, etc.)
  - Extract data from web pages
  - Evaluate JavaScript in page context
  - **Request state from background** via message passing (no direct storage access)

#### Data Storage

- **Technology**: IndexDB with Dexie.js wrapper
- **Responsibilities**:
  - Persistent storage for logs, metrics, and large data operations
  - Efficient handling of screenshot data and automation results
  - Configuration persistence across sessions
  - Data synchronization between components

## Message Flow

### Server to Extension Flow

```
[WebSocket Server]
       ↓ (WebSocket message)
[Background Service Worker - ws.onmessage]
       ↓ (Parse and route command)
[Operation Execution]
       ↓ (Either direct or forwarded to content script)
[Result Generation]
       ↓ (Send result back to server)
[WebSocket Server]
```

### Extension to Server Flow

```
[Operation Result]
       ↓ (Format response)
[Background Service Worker - send()]
       ↓ (WebSocket send)
[WebSocket Server]
```

### Internal Extension Communication

1. **Popup ↔ Background**: Chrome extension messaging API for status updates and commands
2. **Options Page ↔ Background**: Chrome extension messaging API for advanced configuration and logging
3. **Background ↔ Content Script**: Chrome tabs messaging API for DOM operations
4. **All Components ↔ IndexDB**: Dexie.js wrapper for persistent data storage and retrieval

The extension follows a hub-and-spoke architecture with the Background Service Worker acting as the central coordinator and **sole state manager**. All communication between components is asynchronous to maintain responsiveness.

#### State Management Pattern

The background service worker serves as the **centralized state manager** with exclusive access to `chrome.storage`. This ensures consistent state across all components:

- **Centralized State Authority**: Only the background service worker can directly access `chrome.storage`
- **State Retrieval**: All other components (popup, options page, content scripts) must send `"GET_STATE"` messages to request current state
- **State Updates**: When a component needs to update state:
  1. It sends a `"SET_STATE"` message to the background
  2. Background updates `chrome.storage`
  3. Background broadcasts the update to all relevant components
  4. Components receive the broadcast and send `"GET_STATE"` to retrieve updated values
- **Security Enforcement**: Content scripts and UI components are **prohibited** from direct `chrome.storage` access

This pattern prevents race conditions, ensures data consistency, and maintains strict security boundaries between extension components.

```
                     GLOBAL EXTENSION
          ┌──────────────────────────────────────┐
          │       ONE BACKGROUND (Service Worker)│
          │           Single global brain        │
          └───────────────────┬──────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┬────────────────────────┐
        │                     │                     │                        │
┌───────▼───────┐   ┌─────────▼────────┐     ┌──────▼────────┐     ┌─────────▼─────────┐
│  Tab 1        │   │  Tab 2           │     │ Popup Window  │     │   Options PAGE    │
│  Content.js   │   │  Content.js      │     │ popup.js      │     │   options.js      │
│  (per tab)    │   │  (per tab)       │     │ (temporary)   │     │   (persistent)    │
└───────────────┘   └──────────────────┘     └───────────────┘     └─────────┬─────────┘
                                                                             │
                                                                             ▼
                                                                       ┌─────────────┐
                                                                       │   IndexDB   │
                                                                       │ (via Dexie) │
                                                                       └─────────────┘
```

## Extension Capabilities

### Browser-Level Operations (Background Service Worker)

#### Navigation

- Open URLs in existing or new tabs
- Wait for complete page loading
- Return page metadata after navigation

#### Screenshots

- Capture visible tab content
- Support multiple image formats (PNG, JPEG)
- Return base64 encoded image data

#### Waiting Operations

- Time-based delays
- Configurable wait durations

#### Downloads

- Trigger file downloads
- Monitor download progress
- Return download completion information

#### JavaScript Evaluation

- Execute code in MAIN world context
- Bypass Content Security Policy restrictions
- Return execution results

### DOM-Level Operations (Content Script Executor)

#### Element Interaction

- Click elements by CSS selector
- Fill form inputs with values
- Simulate typing with character delays
- Hover over elements
- Select dropdown options

#### Mouse Operations

- Move cursor to specific coordinates
- Click at specific coordinates
- Scroll page in various directions

#### Synchronization

- Wait for elements to appear/disappear
- Wait for visibility state changes

#### Data Extraction

- Extract text from single/multiple elements
- Extract HTML content
- Extract attribute values
- Extract structured data from lists

#### Keyboard Operations

- Simulate key presses (Enter, Tab, Escape, etc.)
- Special handling for navigation keys

#### Advanced Scripting

- Execute JavaScript in page context
- Access full DOM APIs

## Data Storage and Management

### IndexDB with Dexie.js

To efficiently handle large data operations, logging, and persistent storage, the extension utilizes IndexDB with the Dexie.js wrapper:

#### Capabilities

- **Efficient Large Data Storage**: Store screenshots, automation results, and large datasets
- **Persistent Logging**: Maintain detailed operation logs across sessions
- **Configuration Storage**: Save user preferences and settings
- **Performance Metrics**: Store execution timing and resource usage data
- **Asynchronous Operations**: Non-blocking data storage and retrieval

#### Implementation

- **Dexie.js Wrapper**: Simplified Promise-based API for IndexDB operations
- **Data Models**: Structured schemas for logs, configurations, and results
- **Efficient Queries**: Indexed lookups for fast data retrieval
- **Storage Management**: Automatic cleanup and space optimization

## Security Model

### Permissions

The extension requires several Chrome permissions:

- `activeTab`: Access to current tab
- `tabs`: Tab management capabilities
- `scripting`: Content script injection
- `downloads`: Download monitoring
- `storage`: Configuration persistence
- `alarms`: Connection keep-alive
- `host_permissions: ["<all_urls>"]`: Access to all websites

### Isolation

- Browser operations handled in extension context
- DOM operations delegated to content script isolation
- Secure message passing between components

### JavaScript Execution Security

#### Current Implementation Risks

The extension provides two mechanisms for JavaScript evaluation:

1. **Content Script Context** (`eval` in content/executor.js): Executes in an isolated world with limited access to page variables
2. **Main World Context** (`Function` constructor in background service worker): Executes in the page's JavaScript context with full access

Both approaches carry potential security risks as they enable arbitrary code execution on websites visited by the user.

#### Security Mitigations

##### Pre-execution Validation

- **Code Analysis**: Parse JavaScript code for dangerous patterns before execution
- **API Restriction**: Prohibit access to powerful APIs like `fetch`, `XMLHttpRequest`, or file system operations
- **URL Safety**: Block attempts to redirect or navigate the browser to malicious sites
- **Resource Limits**: Prevent infinite loops or excessive resource consumption

##### Runtime Sandboxing

- **Execution Timeouts**: Enforce strict timeout limits on JavaScript execution
- **Memory Monitoring**: Track memory usage to prevent excessive consumption
- **API Interception**: Monitor and potentially block dangerous API calls

##### User Notification System

- **Execution Prompts**: Display warnings to users before executing JavaScript from external sources
- **Permission Levels**: Different authorization levels for different types of code execution
- **Audit Logging**: Record all JavaScript execution for security review
- **Opt-in Requirements**: Require explicit user consent for certain high-risk operations

##### Safe Execution Environment

- **Restricted Context**: Execute untrusted code in a more restricted environment when possible
- **Result Sanitization**: Cleanse return values to prevent injection attacks
- **Isolation Boundaries**: Maintain strict separation between execution contexts

## Communication Protocol

### WebSocket Message Format

Messages between server and extension use JSON format with the following structure:

```json
{
  "id": "unique_command_id",
  "type": "execute-step",
  "step": {
    "operation": "operation_name",
    "...": "operation_specific_parameters"
  }
}
```

### Response Format

```json
{
  "id": "corresponding_command_id",
  "type": "step-result",
  "success": true/false,
  "data": {},
  "error": "error_message_if_failed"
}
```

### Complete Message Type Definitions

#### 1. Execute Step Command

This is the primary message type used to instruct the extension to perform automation operations.

**Structure:**

```json
{
  "id": "unique_command_id",
  "type": "execute-step",
  "step": {
    "operation": "operation_name",
    "...": "operation_specific_parameters"
  },
  "tabId": "optional_tab_id"
}
```

#### 2. Ping/Pong Messages

Used for connection keep-alive.

**Ping (Server to Extension):**

```json
{
  "type": "ping"
}
```

**Pong (Extension Response):**

```json
{
  "type": "pong"
}
```

#### 3. Status Message

Sent by the extension to report its current status.

**Structure:**

```json
{
  "type": "status",
  "connected": true,
  "activeTabId": 123,
  "activeTabUrl": "https://example.com"
}
```

### Supported Operations and Parameters

#### Browser-Level Operations (Executed by Background Service Worker)

##### Navigate

Navigates to a URL in the current or specified tab.

- `url` (string, required): The URL to navigate to
- `timeout` (number, optional): Timeout in milliseconds (default: 30000)

##### Screenshot

Takes a screenshot of the current tab.

- `screenshotType` (string, optional): "png" or "jpeg" (default: "png")
- `quality` (number, optional): Quality for JPEG (1-100, default: 80)

##### Wait

Waits for a specified amount of time.

- `waitTime` (number, required): Time to wait in milliseconds
- `value` (number, optional): Alternative way to specify wait time

##### Download

Triggers a download by clicking an element.

- `selector` (string, optional): CSS selector for the download trigger element
- `timeout` (number, optional): Timeout for download completion (default: 30000)

##### Evaluate (Main World)

Executes JavaScript in the MAIN world context.

- `jsCode` (string, required): JavaScript code to execute

#### DOM-Level Operations (Executed by Content Script)

##### Click

Clicks an element identified by a CSS selector.

- `selector` (string, required): CSS selector for the element to click

##### Fill

Fills an input field with a value.

- `selector` (string, required): CSS selector for the input element
- `value` (string, required): Value to fill the input with

##### Type

Simulates typing character by character in an input field.

- `selector` (string, required): CSS selector for the input element
- `value` (string, required): Text to type
- `typeDelay` (number, optional): Delay between characters in milliseconds (default: 50)

##### Hover

Simulates hovering over an element.

- `selector` (string, required): CSS selector for the element to hover over

##### Mouse Operations

- `mouseMove`: Move cursor to specific coordinates
  - `x` (number, required): X coordinate
  - `y` (number, required): Y coordinate
- `mouseClick`: Click at specific coordinates
  - `x` (number, required): X coordinate
  - `y` (number, required): Y coordinate

##### Scroll

Scrolls the page.

- `scrollDirection` (string, optional): "down", "up", "top", "bottom"
- `scrollDistance` (number, optional): Distance to scroll in pixels
- `selector` (string, optional): Scroll specific element into view

##### Wait for Selector

Waits for an element to appear, disappear, or change visibility.

- `selector` (string, required): CSS selector to wait for
- `timeout` (number, optional): Timeout in milliseconds (default: 10000)
- `state` (string, optional): "visible", "hidden", "attached", "detached" (default: "visible")

##### Get Text

Extracts text content from an element.

- `selector` (string, required): CSS selector for the element

##### Get Texts

Extracts text content from multiple elements.

- `selector` (string, required): CSS selector for the elements

##### Get HTML

Extracts inner HTML from an element.

- `selector` (string, required): CSS selector for the element

##### Get Attribute

Extracts an attribute value from an element.

- `selector` (string, required): CSS selector for the element
- `attribute` (string, required): Name of the attribute to extract

##### Press

Simulates pressing a key.

- `key` (string, required): Key to press (e.g., "Enter", "Tab", "Escape")
- `selector` (string, optional): Element to focus before pressing key
- `shiftKey` (boolean, optional): Whether to press Shift key

##### Select

Selects an option in a dropdown.

- `selector` (string, required): CSS selector for the select element
- `selectValue` (string, required): Value of the option to select

##### Evaluate (Content Script)

Executes JavaScript in the content script context.

- `jsCode` (string, required): JavaScript code to execute

##### Extract Items

Extracts structured data from a list of elements.

- `listItemSelector` (string, required): CSS selector for list items
- `fields` (array, required): Array of field definitions
  - `name` (string, required): Field name in the result
  - `selector` (string, required): CSS selector relative to list item
  - `attribute` (string, optional): Attribute to extract instead of text

## Connection Management

### Keep-Alive Mechanisms

1. **WebSocket Heartbeat**: Ping messages every 20 seconds
2. **Chrome Alarms**: Periodic wake-up to maintain service worker
3. **Automatic Reconnection**: Retry logic for connection failures

### Status Reporting

- Real-time connection state to popup UI
- Active tab tracking
- Error state propagation

## Error Handling

### Categories

1. **Connection Errors**: WebSocket disconnects, server unavailability
2. **Operation Errors**: Element not found, timeout exceeded, JavaScript errors
3. **Browser Errors**: Permission issues, tab closed, navigation failures

### Handling Strategy

- Detailed error messages sent back to server
- Graceful degradation for non-critical failures
- Automatic retry for transient errors

## Extensibility

### Adding New Operations

1. Define operation in background service worker or content script
2. Implement command handling logic
3. Update message routing as needed
4. Return appropriate result format

### Customization Points

- Server URL configuration
- Timeout values
- Retry logic parameters
- Operation-specific options

## Performance Considerations

### Resource Management

- Efficient content script injection only when needed
- Cleanup of unused resources
- Connection pooling for persistent operations
- IndexDB storage management using Dexie.js for large data operations
- Memory-efficient handling of screenshot data and logs

### Latency Optimization

- Asynchronous operation execution
- Parallel processing where possible
- Minimal overhead in message routing
- Efficient data storage and retrieval with IndexDB for large datasets

## Future Enhancements

### Potential Improvements

- Support for multiple concurrent tabs
- Enhanced browser context management
- Extended device simulation capabilities
- Improved error recovery mechanisms
- Advanced selector strategies
- Integration with Dexie.js for IndexDB data storage to handle large data operations
- Options page with advanced UI capabilities for log viewing and management

## Logging and Metrics

### AOP-like Instrumentation

To facilitate debugging and performance analysis, the extension can implement cross-cutting concerns for logging and metrics collection:

#### Operation Logging

- **Execution Tracing**: Log start and completion of each operation with timestamps
- **Performance Metrics**: Record execution duration for each operation type
- **Error Tracking**: Capture and categorize all operation failures
- **Resource Usage**: Monitor memory and CPU usage during intensive operations

#### Diagnostic Capabilities

- **Verbose Mode**: Toggle detailed logging for troubleshooting
- **Operation History**: Maintain in-memory history of recent operations
- **Performance Profiling**: Collect timing data for optimization opportunities
- **Connection Statistics**: Track WebSocket message volume and latency

#### Implementation Strategy

1. **Decorator Pattern**: Wrap operation execution with logging/metrics collection
2. **Centralized Logger**: Single logging module for consistent formatting
3. **Configurable Levels**: Support for different logging verbosity levels
4. **Export Capability**: Ability to export logs for external analysis

#### Data Collection Points

- Command receipt from WebSocket server
- Operation routing decisions
- Content script injection events
- Result transmission back to server
- Error occurrences and recovery attempts
- Connection state changes
- Tab lifecycle events

### Analytics Framework

- **Usage Statistics**: Aggregate operation frequency and success rates
- **Performance Dashboards**: Real-time monitoring of execution metrics
- **Anomaly Detection**: Identify unusual patterns in operation behavior
- **Capacity Planning**: Track resource consumption for scaling decisions

### Options Page Logging Features

- **Log Viewer**: Comprehensive interface for viewing detailed operation logs
- **Log Filtering**: Filter logs by operation type, status, timestamp, or search terms
- **Log Management**: Clear, export, or archive logs through UI controls
- **Real-time Monitoring**: Live updating of logs and metrics in the options page
- **Data Persistence**: Store logs in IndexDB using Dexie.js for efficient retrieval
- **Export Capabilities**: Export logs in multiple formats (JSON, CSV, plain text)

These logging and metrics capabilities would provide valuable insights into extension behavior while supporting ongoing optimization efforts. The options page provides an advanced interface for users to monitor, analyze, and manage automation operations.

## Usage Patterns

### Typical Automation Flow

1. Connect to WebSocket server
2. Navigate to target website
3. Perform series of interactions
4. Extract required data
5. Take screenshots as needed
6. Handle downloads if required
7. Report results back to server

This design enables comprehensive browser automation while maintaining security boundaries and providing a robust communication framework between the automation server and the Chrome browser.
