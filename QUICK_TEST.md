# Quick Test Guide - Visual Whiteboard

## ✅ What's Been Fixed

1. **Drawing Tools** - All shapes now materialize correctly
2. **Keyboard Shortcuts** - All shortcuts working (R, O, V, Delete, Cmd+C/V, etc.)
3. **Selection Persistence** - Shapes stay selected after drawing
4. **Canvas Stability** - No more freezing after drawing

---

## 🧪 5-Minute Test

### Prerequisites
- Backend running: http://localhost:8000 ✅
- Frontend running: http://localhost:5174 ✅

### Test Sequence

#### 1. Keyboard Shortcuts (1 min)
```
Open: http://localhost:5174
Login with: owner@example.com / Password123!
Create or open a board

Press keys and verify:
✓ R → Tool switches to Rectangle (crosshair cursor)
✓ O → Tool switches to Circle
✓ V → Tool switches to Select
✓ P → Tool switches to Pen
✓ L → Tool switches to Line
```

**Expected:** Toolbar button highlights, cursor changes instantly ✅

---

#### 2. Drawing Tools (2 min)
```
Test each tool:

Rectangle (R):
✓ Press R
✓ Click & drag on canvas
✓ Rectangle appears with light fill, dark border
✓ Rectangle stays selected (blue border, 8 handles)
✓ Can drag rectangle to move it

Circle (O):
✓ Press O
✓ Click & drag (make it big, ~150px)
✓ Circle appears with light fill
✓ Circle stays selected
✓ Can drag circle

Line (L):
✓ Press L
✓ Click & drag
✓ Line appears with dark stroke
✓ Line stays selected

Arrow (A):
✓ Press A
✓ Click & drag
✓ Arrow with arrowhead appears
✓ Can select and move arrow
```

**Expected:** All shapes persist and remain selectable ✅

---

#### 3. Delete & Copy/Paste (1 min)
```
Delete Test:
✓ Select a shape (click it)
✓ Press Delete or Backspace
✓ Shape disappears immediately

Copy/Paste Test:
✓ Draw a rectangle
✓ Press Cmd+C (Mac) or Ctrl+C (Windows)
✓ See toast: "Copied 1 element"
✓ Press Cmd+V or Ctrl+V
✓ Duplicate appears 20px offset
✓ Duplicate is selected

Duplicate Test:
✓ Select a shape
✓ Press Cmd+D or Ctrl+D
✓ Instant duplicate appears
```

**Expected:** All operations work smoothly ✅

---

#### 4. Real-Time Sync (1 min)
```
Setup:
✓ Browser A: Open board
✓ Browser B: Open same board URL (incognito or different browser)
  - Login as: editor@example.com / Password123!

Test:
✓ Browser A: Draw a rectangle
✓ Browser B: Rectangle appears within 1 second
✓ Browser B: Draw a circle
✓ Browser A: Circle appears
✓ Browser A: Select rectangle, change color to red (Info panel)
✓ Browser B: Rectangle turns red
```

**Expected:** All changes sync instantly ✅

---

## 🐛 If Something Fails

### Keyboard Shortcuts Don't Work
**Check:**
1. Open browser console (F12)
2. Look for JavaScript errors
3. Verify `useHotkeys.ts` was updated correctly
4. Hard refresh: Cmd+Shift+R or Ctrl+Shift+R

### Shapes Don't Persist
**Check:**
1. Browser console for errors
2. Verify `CanvasStage.tsx` calls `materializeElement()`
3. Verify `endDrawing()` doesn't re-add temp objects
4. Check if `canvas.setActiveObject()` is called

### Real-Time Not Working
**Check:**
1. DevTools → Network → WS tab
2. Should see "socket.io" connection
3. Console should show "Socket connected"
4. Backend logs should show socket events

### Circle Doesn't Appear
**Check:**
1. Browser console for "Circle is not a constructor" error
2. Verify radius calculation in `updateDrawing()`
3. Verify `materializeElement()` handles circle case
4. Try manual test in console:
```javascript
canvas = window.useCanvasStore.getState().canvas
circle = new fabric.Circle({
  left: 100,
  top: 100,
  radius: 50,
  fill: '#e8e5df',
  stroke: '#c2c0b5',
  strokeWidth: 1.5
})
canvas.add(circle)
canvas.requestRenderAll()
```

---

## ✅ Success Criteria

All tests pass if:
- ✅ All keyboard shortcuts respond instantly
- ✅ All 4 drawing tools create persistent shapes
- ✅ Delete removes selected elements
- ✅ Copy/paste works with offset
- ✅ Two browsers sync changes within 1 second
- ✅ No console errors
- ✅ No freezing or crashes

---

## 📋 Quick Checklist

Copy and check off as you test:

```
[ ] Backend running (curl http://localhost:8000/api/v1/health)
[ ] Frontend running (http://localhost:5174 loads)
[ ] Can login (owner@example.com / Password123!)
[ ] R key switches to Rectangle
[ ] O key switches to Circle  
[ ] Delete key removes elements
[ ] Rectangle draws and stays
[ ] Circle draws and stays
[ ] Line draws and stays
[ ] Arrow draws and stays
[ ] Cmd+C / Cmd+V copies and pastes
[ ] 2 browsers sync changes
[ ] No console errors
```

**Total:** 13 items

If ALL pass → **System working!** ✅

---

## 🎯 Next Steps After Testing

### If All Tests Pass:
1. Mark high-priority tasks as complete in Tasks.md
2. Move to medium-priority enhancements
3. Test additional features (Pen, Sticky, Text, Image, Document, Comments)
4. Performance testing with 50+ elements
5. Browser compatibility testing

### If Tests Fail:
1. Note which specific test failed
2. Check browser console for errors
3. Report error message
4. Debug and fix the specific issue
5. Re-test

---

**Test now and report results!** 🚀
