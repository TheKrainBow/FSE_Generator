import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'

interface Size {
  width: number
  height: number
}

export function useElementSize<T extends HTMLElement>(): [MutableRefObject<T | null>, Size] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(node)
    setSize({ width: node.offsetWidth, height: node.offsetHeight })
    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, size]
}
