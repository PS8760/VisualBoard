# Comprehensive Feature Test Plan

## Test Execution Date: 2026-08-20

---

## 1. Authentication Tests

### 1.1 Registration
- [ ] Navigate to `/register`
- [ ] Fill in name, email, password
- [ ] Submit form
- [ ] Verify redirect to dashboard
- [ ] Verify JWT token stored

### 1.2 Login
- [ ] Navigate to `/login`
- [ ] Enter credentials (owner@example.com / Password123!)
- [ ] Submit form
- [ ] Verify redirect to dashboard
- [ ] Verify user name displayed

### 1.3 OAuth (GitHub/Google)
- [ ] Click GitHub button
- [ ] Verify OAuth flow initiates
- [ ] (Manual test - requires OAuth setup)

---

## 2. Dashboard Tests

### 2.1 Board List
- [ ] Verify existing boards displayed
- [ ] Verify board thumbnails/titles
- [ ] Verify "Create Board" button visible

### 2.2 Create Board
- [ ] Click "Create Board"
- [ ] Enter board name
- [ ] Submit
- [ ] Verify redirect to new board
- [ ] Verify board appears in dashboard

---

## 3. Canvas & Toolbar Tests

### 3.1 Toolbar Visibility
- [x] FIXED: All 12 tools visible in left sidebar
- [x] Verify icons: Select, Hand, Pen, Rectangle, Circle, Line, Arrow, Text, Sticky, Image, Document, Comment

### 3.2 Tool Activation
- [ ] Click each tool - verify icon highlights
- [ ] Press keyboard shortcuts (V, H, P, R, O, L, A, T, S, I, D, C)
- [ ] Verify cursor changes appropriately

### 3.3 Select Tool (V)
- [ ] Click Select tool
- [ ] Click existing element - verify selection handles appear
- [ ] Drag element - verify moves
- [ ] Resize via handles - verify resizes
- [ ] Rotate via handle - verify rotates
- [ ] Click canvas background - verify deselects

### 3.4 Hand Tool (H)
- [ ] Click Hand tool
- [ ] Click and drag - verify canvas pans
- [ ] Press Space while on other tool - verify temporary pan mode

### 3.5 Pen Tool (P)
- [ ] Click Pen tool
- [ ] Verify secondary toolbar appears (width & color options)
- [ ] Select width (1px, 2px, 4px, 8px)
- [ ] Draw freehand path - verify stroke appears
- [ ] Change color (black, orange, blue, green, red, custom)
- [ ] Draw again - verify new color applied

### 3.6 Rectangle Tool (R)
- [ ] Click Rectangle tool
- [ ] Click and drag - verify rectangle drawn
- [ ] Hold Shift while dragging - verify perfect square
- [ ] Verify dimension tooltip appears while drawing
- [ ] Release - verify auto-switches to Select tool
- [ ] Verify rectangle persists

### 3.7 Circle Tool (O)
- [ ] Click Circle tool
- [ ] Click and drag - verify ellipse/circle drawn
- [ ] Hold Shift while dragging - verify perfect circle
- [ ] Verify dimension tooltip
- [ ] Release - verify auto-switches to Select tool

### 3.8 Line Tool (L)
- [ ] Click Line tool
- [ ] Click and drag - verify line drawn
- [ ] Hold Shift - verify snaps to 45° angles (0°, 45°, 90°, 135°, 180°)
- [ ] Release - verify auto-switches to Select tool

### 3.9 Arrow Tool (A)
- [ ] Click Arrow tool
- [ ] Click and drag - verify arrow drawn with arrowhead
- [ ] Hold Shift - verify angle snapping
- [ ] Release - verify auto-switches to Select tool

### 3.10 Text Tool (T)
- [ ] Click Text tool
- [ ] Click on canvas - verify text box appears with "Type something..."
- [ ] Type text - verify editable
- [ ] Click outside - verify text persists
- [ ] Double-click text later - verify can re-edit

### 3.11 Sticky Note Tool (S)
- [ ] Click Sticky tool
- [ ] Click on canvas - verify yellow sticky note appears
- [ ] Type text - verify editable
- [ ] Click outside - verify note persists
- [ ] Double-click sticky later - verify can re-edit

### 3.12 Image Tool (I)
- [ ] Click Image tool
- [ ] Verify file picker opens
- [ ] Select image file (PNG, JPEG, GIF, WebP, < 10MB)
- [ ] Verify image appears at click location
- [ ] Verify scaled to reasonable size
- [ ] Verify can move/resize image

### 3.13 Document Tool (D)
- [ ] Click Document tool
- [ ] Verify document card appears on canvas
- [ ] Drag file onto document card
- [ ] Verify file name updates
- [ ] Verify file can be downloaded (click document)

### 3.14 Comment Tool (C)
- [ ] Click Comment tool
- [ ] Click on canvas - verify orange comment marker appears
- [ ] Verify right panel opens to Comments tab
- [ ] Verify comment thread appears
- [ ] Type comment - verify saves
- [ ] Verify marker persists on canvas

---

## 4. Canvas Interaction Tests

### 4.1 Pan & Zoom
- [ ] Mouse wheel up/down - verify canvas pans vertically
- [ ] Shift + Mouse wheel - verify horizontal pan
- [ ] Cmd/Ctrl + Mouse wheel - verify zoom in/out
- [ ] Click zoom icons in status bar - verify zoom changes
- [ ] Press `1` - verify 100% zoom
- [ ] Press `2` - verify 50% zoom
- [ ] Press `3` - verify 200% zoom
- [ ] Press `0` - verify fits all elements to view

### 4.2 Grid
- [ ] Press `G` - verify grid toggles on/off
- [ ] Verify grid follows zoom/pan
- [ ] Draw with grid on - verify snapping behavior

### 4.3 Multi-Select
- [ ] Click and drag on empty canvas (Select tool) - verify rubber band appears
- [ ] Release - verify elements within bounds selected
- [ ] Hold Shift + click elements - verify adds to selection
- [ ] Click outside - verify deselects all

### 4.4 Undo/Redo
- [ ] Draw element
- [ ] Press Cmd+Z - verify undo
- [ ] Verify element removed
- [ ] Press Cmd+Shift+Z - verify redo
- [ ] Verify element restored
- [ ] Test undo history depth (max 60 steps)

### 4.5 Copy/Paste/Duplicate
- [ ] Select element
- [ ] Press Cmd+C - verify copied
- [ ] Press Cmd+V - verify pasted with offset
- [ ] Press Cmd+D - verify duplicated immediately
- [ ] Verify originals unchanged

### 4.6 Delete
- [ ] Select element
- [ ] Press Delete or Backspace
- [ ] Verify element removed
- [ ] Press Cmd+Z - verify undo restores element

### 4.7 Select All
- [ ] Press Cmd+A
- [ ] Verify all elements selected
- [ ] Verify selection count in UI

---

## 5. Properties Panel Tests

### 5.1 Panel Visibility
- [ ] Select element
- [ ] Verify right panel shows "Properties" tab
- [ ] Verify fill, stroke, strokeWidth, opacity controls visible

### 5.2 Fill Color
- [ ] Select rectangle
- [ ] Click fill color picker
- [ ] Select color
- [ ] Verify rectangle fill updates immediately

### 5.3 Stroke Color
- [ ] Select rectangle
- [ ] Click stroke color picker
- [ ] Select color
- [ ] Verify rectangle stroke updates

### 5.4 Stroke Width
- [ ] Select rectangle with stroke
- [ ] Change strokeWidth slider
- [ ] Verify stroke thickness updates

### 5.5 Opacity
- [ ] Select element
- [ ] Change opacity slider (0-100%)
- [ ] Verify element transparency updates

### 5.6 Text Properties
- [ ] Select text element
- [ ] Change fontSize slider
- [ ] Verify text size updates
- [ ] Change fontFamily dropdown
- [ ] Verify font updates

### 5.7 Multi-Select Properties
- [ ] Select multiple elements
- [ ] Verify properties show common values
- [ ] Change fill color
- [ ] Verify all selected elements update

---

## 6. Real-Time Collaboration Tests

### 6.1 Socket Connection
- [ ] Check browser console for Socket.IO connection messages
- [ ] Verify "Connected" status (green dot) in status bar
- [ ] Refresh page - verify reconnects automatically

### 6.2 User Presence
- [ ] Open same board in 2 browser windows (different users)
- [ ] Verify user count updates in top bar
- [ ] Verify user avatars/names visible

### 6.3 Live Cursors
- [x] FIXED: Cursor position animates smoothly
- [ ] Move cursor in window 1
- [ ] Verify cursor appears in window 2 with user name label
- [ ] Verify label stays attached to cursor (not moving independently)
- [ ] Verify cursor disappears when user leaves

### 6.4 Element Sync
- [ ] Draw element in window 1
- [ ] Verify appears immediately in window 2
- [ ] Move element in window 2
- [ ] Verify updates in window 1
- [ ] Delete in window 1
- [ ] Verify removed in window 2

### 6.5 Comment Sync
- [ ] Add comment in window 1
- [ ] Verify comment marker appears in window 2
- [ ] Reply in window 2
- [ ] Verify reply appears in window 1

---

## 7. Auto-Arrangement Tests

### 7.1 Button Visibility
- [ ] Verify "Auto Arrange" button in status bar
- [ ] Verify button disabled on empty board
- [ ] Add elements - verify button enabled

### 7.2 Arrangement Execution
- [ ] Draw 5-10 scattered elements
- [ ] Click "Auto Arrange" button (or press Shift+A)
- [ ] Verify loading toast appears
- [ ] Verify elements animate to new positions
- [ ] Verify success toast appears
- [ ] Verify elements organized (no overlaps, grouped by connections)

### 7.3 Arrangement Backend
- [ ] Check network tab - verify POST to `/boards/:id/arrange`
- [ ] Verify 200 response with updated element positions
- [ ] Verify changes saved (refresh page, verify persist)

---

## 8. Version Control Tests

### 8.1 Version History Access
- [ ] Click clock icon in top bar
- [ ] Verify "Version History" panel slides in
- [ ] Verify list of versions with timestamps

### 8.2 Version Creation
- [ ] Draw element
- [ ] Wait 1 second
- [ ] Check version history - verify new snapshot created
- [ ] Modify element
- [ ] Wait 1 second
- [ ] Verify another snapshot created

### 8.3 Version Restore
- [ ] Make several changes to board
- [ ] Open version history
- [ ] Click on old version
- [ ] Verify preview updates
- [ ] Click "Restore" button
- [ ] Verify confirmation modal
- [ ] Confirm restore
- [ ] Verify board reverts to old state
- [ ] Verify safety snapshot created before restore

### 8.4 Version Backend
- [ ] Check network tab during restore
- [ ] Verify POST to `/versions/:id/restore`
- [ ] Verify 200 response
- [ ] Verify board reloads with restored state

---

## 9. AI Suggestions Tests

### 9.1 Suggestions Panel
- [ ] Click sparkles icon in top bar (or Cmd+K → "Get AI Suggestions")
- [ ] Verify right panel opens to "Suggestions" tab
- [ ] Verify loading spinner appears

### 9.2 Suggestion Generation
- [ ] Add several architecture elements (rectangles, arrows, text labels)
- [ ] Request suggestions
- [ ] Verify API call to POST `/boards/:id/suggestions`
- [ ] Verify suggestions appear (missing components, security, performance, scalability)
- [ ] Verify structured format (categories, bullet points)

### 9.3 Suggestion Quality
- [ ] Verify suggestions are contextual to board content
- [ ] Verify suggestions actionable (specific recommendations)
- [ ] Verify no generic/placeholder text

---

## 10. Document Management Tests

### 10.1 Document Upload
- [ ] Place document element on canvas
- [ ] Drag PDF file onto document card
- [ ] Verify file name updates
- [ ] Verify file icon appears
- [ ] Hover - verify tooltip with file info (name, size, type)

### 10.2 Document Download
- [ ] Click document card with attached file
- [ ] Verify download initiates
- [ ] Verify correct file downloaded

### 10.3 Document Backend
- [ ] Check network tab during upload
- [ ] Verify POST to `/boards/:boardId/documents` with multipart form data
- [ ] Verify 201 response with document metadata
- [ ] Verify GET `/documents/:id/download` during download

---

## 11. Comment System Tests

### 11.1 Comment Creation
- [ ] Use Comment tool (C) to place marker
- [ ] Verify right panel opens to Comments tab
- [ ] Type comment text
- [ ] Submit
- [ ] Verify comment persists

### 11.2 Comment Threads
- [ ] Click existing comment marker
- [ ] Verify thread opens in right panel
- [ ] Add reply
- [ ] Verify reply appears in thread
- [ ] Verify chronological order

### 11.3 Comment Deletion
- [ ] Hover over comment
- [ ] Click delete icon
- [ ] Verify comment removed from thread
- [ ] If last comment - verify marker removed from canvas

### 11.4 Comment Backend
- [ ] Verify POST to `/boards/:boardId/comments`
- [ ] Verify comment includes coordinates (x, y)
- [ ] Verify DELETE `/comments/:id` for deletion

---

## 12. Board Member Management Tests

### 12.1 Share Modal
- [ ] Click "Share" button in top bar
- [ ] Verify modal opens with member list
- [ ] Verify current members shown with roles

### 12.2 Invite Member
- [ ] Enter email in "Add member" field
- [ ] Select role (Viewer, Editor, Owner)
- [ ] Click "Invite"
- [ ] Verify invite sent (toast notification)
- [ ] Verify new member appears in list

### 12.3 Role Changes
- [ ] Change member role (Viewer → Editor)
- [ ] Verify PUT to `/boards/:id/members/:userId`
- [ ] Verify role updates immediately
- [ ] Open board as that user - verify permissions match

### 12.4 Remove Member
- [ ] Click remove button next to member
- [ ] Verify confirmation modal
- [ ] Confirm removal
- [ ] Verify member removed from list
- [ ] Verify DELETE to `/boards/:id/members/:userId`

---

## 13. Authorization Tests

### 13.1 Viewer Permissions
- [ ] Login as viewer (viewer@example.com / Password123!)
- [ ] Open shared board
- [ ] Verify can pan/zoom
- [ ] Try to draw - verify blocked (toast error: "Permission denied")
- [ ] Try to delete - verify blocked
- [ ] Try to modify - verify blocked
- [ ] Verify can add comments only

### 13.2 Editor Permissions
- [ ] Login as editor (editor@example.com / Password123!)
- [ ] Open shared board
- [ ] Verify can draw all elements
- [ ] Verify can modify elements
- [ ] Verify can delete elements
- [ ] Verify can add comments
- [ ] Try to delete board - verify blocked
- [ ] Try to change members - verify blocked

### 13.3 Owner Permissions
- [ ] Login as owner (owner@example.com / Password123!)
- [ ] Verify can do everything
- [ ] Verify can access board settings
- [ ] Verify can delete board
- [ ] Verify can manage members

---

## 14. Keyboard Shortcuts Tests

### 14.1 Tool Shortcuts
- [ ] Press V - verify Select tool
- [ ] Press H - verify Hand tool
- [ ] Press P - verify Pen tool
- [ ] Press R - verify Rectangle tool
- [ ] Press O - verify Circle tool
- [ ] Press L - verify Line tool
- [ ] Press A - verify Arrow tool
- [ ] Press T - verify Text tool
- [ ] Press S - verify Sticky tool
- [ ] Press I - verify Image tool
- [ ] Press D - verify Document tool
- [ ] Press C - verify Comment tool

### 14.2 Editing Shortcuts
- [ ] Cmd+C - verify copy
- [ ] Cmd+V - verify paste
- [ ] Cmd+D - verify duplicate
- [ ] Cmd+A - verify select all
- [ ] Cmd+Z - verify undo
- [ ] Cmd+Shift+Z - verify redo
- [ ] Delete - verify delete
- [ ] Escape - verify return to Select tool

### 14.3 View Shortcuts
- [ ] 1 - verify 100% zoom
- [ ] 2 - verify 50% zoom
- [ ] 3 - verify 200% zoom
- [ ] 0 - verify fit to view
- [ ] G - verify toggle grid
- [ ] Cmd+ = - verify zoom in
- [ ] Cmd+ - - verify zoom out

### 14.4 Action Shortcuts
- [ ] Cmd+K - verify command palette opens
- [ ] Shift+A - verify auto arrange

---

## 15. Command Palette Tests

### 15.1 Palette Access
- [ ] Press Cmd+K
- [ ] Verify modal opens with search input
- [ ] Verify focused on input

### 15.2 Command Search
- [ ] Type "arrange"
- [ ] Verify "Auto Arrange Board" appears
- [ ] Press Enter - verify executes
- [ ] Type "version"
- [ ] Verify "Version History" appears
- [ ] Press Enter - verify opens version panel

### 15.3 Command Categories
- [ ] Open palette
- [ ] Verify commands grouped (Tools, Actions, View, Board)
- [ ] Verify icons displayed
- [ ] Verify keyboard shortcuts shown

---

## 16. Onboarding & Help Tests

### 16.1 Onboarding Tutorial
- [ ] Create new board (fresh user)
- [ ] Verify onboarding overlay appears
- [ ] Verify 8 steps (Welcome, Tools, Drawing, Moving, Properties, Collaboration, Features, Get Started)
- [ ] Click "Next" through all steps
- [ ] Verify highlights correct UI areas
- [ ] Click "Skip" - verify dismisses tutorial
- [ ] Verify preference saved (doesn't show again)

### 16.2 Help Button
- [ ] Click question mark button (bottom right)
- [ ] Verify help panel opens
- [ ] Verify keyboard shortcuts reference
- [ ] Verify feature tips
- [ ] Verify links to docs/support

---

## 17. Performance Tests

### 17.1 Canvas Rendering
- [ ] Add 100+ elements to canvas
- [ ] Pan around - verify smooth (60fps)
- [ ] Zoom in/out - verify no lag
- [ ] Select all - verify handles quickly

### 17.2 Real-Time Latency
- [ ] Draw in window 1
- [ ] Measure time until appears in window 2
- [ ] Verify < 100ms latency

### 17.3 Autosave Performance
- [ ] Make rapid changes (draw 10 elements quickly)
- [ ] Verify debounced saves (not saving every change)
- [ ] Check network tab - verify batched requests

---

## 18. Error Handling Tests

### 18.1 Network Errors
- [ ] Disconnect internet
- [ ] Try to save - verify error toast
- [ ] Reconnect - verify auto-reconnect
- [ ] Verify unsaved changes saved after reconnect

### 18.2 Invalid Operations
- [ ] Try to upload 50MB image
- [ ] Verify error toast "File too large"
- [ ] Try to upload invalid file type
- [ ] Verify error toast

### 18.3 Authorization Errors
- [ ] Login as Viewer
- [ ] Try to draw (backend should reject)
- [ ] Verify error toast "Permission denied"

---

## 19. Responsive Design Tests

### 19.1 Mobile Viewport
- [ ] Resize browser to 375px width
- [ ] Verify toolbar still accessible
- [ ] Verify right panel collapses
- [ ] Verify status bar adapts
- [ ] Verify can still draw/pan

### 19.2 Tablet Viewport
- [ ] Resize to 768px width
- [ ] Verify layout adjusts
- [ ] Verify all features accessible

---

## 20. Browser Compatibility Tests

### 20.1 Chrome
- [ ] Run all critical tests in Chrome
- [ ] Verify no console errors

### 20.2 Firefox
- [ ] Run all critical tests in Firefox
- [ ] Verify rendering identical

### 20.3 Safari
- [ ] Run all critical tests in Safari
- [ ] Verify no WebKit-specific issues

---

## Test Results Summary

**Total Tests**: ~200+  
**Passed**: TBD  
**Failed**: TBD  
**Blocked**: TBD  

### Critical Issues Found
- [x] FIXED: Toolbar only showed 2 tools (now shows all 12)
- [x] FIXED: Cursor label moving with cursor (now attached properly)
- [ ] (Add any new issues found)

### Non-Critical Issues
- [ ] (Add any minor issues)

---

## Backend API Tests

Run automated backend tests:
```bash
cd backend && npm test
```

Expected: 78/78 tests passing ✅

---

## End-to-End Test Automation

Consider adding Playwright/Cypress tests for:
- Critical user flows (register → create board → draw → invite)
- Real-time collaboration scenarios
- Authorization enforcement
- Error recovery

---

**Test Status**: IN PROGRESS  
**Last Updated**: 2026-08-20  
**Tester**: Automated + Manual Review Required
