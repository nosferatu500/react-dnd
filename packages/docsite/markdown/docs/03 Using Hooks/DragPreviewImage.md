---
path: '/docs/api/drag-preview-image'
title: 'DragPreviewImage'
---

_New to React DnD? [Read the overview](/docs/overview) before jumping into the docs._

# DragPreviewImage

A Component to render an HTML Image element as a disconnected drag preview.

### Usage

```jsx
import { DragPreviewImage, useDrag } from '@nosferatu500/react-dnd'

function DraggableHouse() {
  const [, drag, preview] = useDrag(() => ({ type: 'house' }))

  return (
    <>
      <DragPreviewImage src="house_dragged.png" connect={preview} />
      <div ref={drag}>🏠</div>
    </>
  )
}
```

### Props

- **`connect`**: Required. The drag preview connector function
