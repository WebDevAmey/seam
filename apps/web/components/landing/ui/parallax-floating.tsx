"use client"

import { useEffect, useRef, useState } from "react"
import { useMotionValue, useSpring } from "motion/react"

interface FloatingProps {
  sensitivity?: number
  className?: string
  children: React.ReactNode
}

interface FloatingElementProps {
  depth?: number
  className?: string
  children: React.ReactNode
}

interface ElementEntry {
  el: HTMLElement
  depth: number
}

function FloatingElement({ depth = 1, className, children }: FloatingElementProps) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ "--depth": depth } as React.CSSProperties}
    >
      {children}
    </div>
  )
}

function Floating({ sensitivity = -0.5, className, children }: FloatingProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 })
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 })

  const [elements, setElements] = useState<ElementEntry[]>([])

  useEffect(() => {
    if (!ref.current) return
    const floaters = Array.from(
      ref.current.querySelectorAll<HTMLElement>("[style*='--depth']")
    ).map((el) => ({
      el,
      depth: parseFloat(el.style.getPropertyValue("--depth") || "1"),
    }))
    setElements(floaters)
  }, [children])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window
      const x = (e.clientX / innerWidth - 0.5) * 2
      const y = (e.clientY / innerHeight - 0.5) * 2
      mouseX.set(x)
      mouseY.set(y)
    }
    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [mouseX, mouseY])

  useEffect(() => {
    const unsubX = springX.on("change", update)
    const unsubY = springY.on("change", update)

    function update() {
      elements.forEach(({ el, depth }) => {
        const moveX = springX.get() * depth * sensitivity * 30
        const moveY = springY.get() * depth * sensitivity * 30
        el.style.transform = `translate(${moveX}px, ${moveY}px)`
      })
    }

    return () => {
      unsubX()
      unsubY()
    }
  }, [elements, springX, springY, sensitivity])

  return (
    <div ref={ref} className={`absolute inset-0 ${className ?? ""}`}>
      {children}
    </div>
  )
}

export default Floating
export { FloatingElement }
