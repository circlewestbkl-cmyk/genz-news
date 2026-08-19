import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Swipe gesture composable for mobile touch interactions
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.onSwipeLeft - Callback for left swipe
 * @param {Function} options.onSwipeRight - Callback for right swipe
 * @param {Function} options.onSwipeUp - Callback for up swipe
 * @param {Function} options.onSwipeDown - Callback for down swipe
 * @param {number} options.threshold - Minimum swipe distance in pixels (default: 50)
 * @param {number} options.velocityThreshold - Minimum velocity in px/ms (default: 0.3)
 */
export function useSwipeGesture(options = {}) {
  const {
    onSwipeLeft = () => {},
    onSwipeRight = () => {},
    onSwipeUp = () => {},
    onSwipeDown = () => {},
    threshold = 50,
    velocityThreshold = 0.3
  } = options

  const touchStart = ref({ x: 0, y: 0, time: 0 })
  const touchEnd = ref({ x: 0, y: 0, time: 0 })
  const isSwiping = ref(false)

  function handleTouchStart(e) {
    const touch = e.touches[0]
    touchStart.value = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
    isSwiping.value = true
  }

  function handleTouchMove(e) {
    if (!isSwiping.value) return
    const touch = e.touches[0]
    touchEnd.value = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    }
  }

  function handleTouchEnd() {
    if (!isSwiping.value) return
    
    const deltaX = touchEnd.value.x - touchStart.value.x
    const deltaY = touchEnd.value.y - touchStart.value.y
    const deltaTime = touchEnd.value.time - touchStart.value.time
    
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime

    if (velocity >= velocityThreshold || Math.abs(deltaX) >= threshold || Math.abs(deltaY) >= threshold) {
      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0) {
          onSwipeRight({ deltaX, deltaY, velocity })
        } else {
          onSwipeLeft({ deltaX: Math.abs(deltaX), deltaY, velocity })
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          onSwipeDown({ deltaX, deltaY, velocity })
        } else {
          onSwipeUp({ deltaX, deltaY: Math.abs(deltaY), velocity })
        }
      }
    }

    isSwiping.value = false
  }

  function handleTouchCancel() {
    isSwiping.value = false
  }

  return {
    isSwiping,
    touchStart,
    touchEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel
  }
}

/**
 * Composable for pull-to-refresh gesture
 * 
 * @param {Object} options
 * @param {Function} options.onRefresh - Callback when refresh is triggered
 * @param {number} options.threshold - Pull distance to trigger refresh (default: 80)
 */
export function usePullToRefresh(options = {}) {
  const { onRefresh = () => {}, threshold = 80 } = options
  
  const pullDistance = ref(0)
  const isPulling = ref(false)
  const isRefreshing = ref(false)
  
  let startY = 0

  function handleTouchStart(e) {
    if (isRefreshing.value) return
    startY = e.touches[0].clientY
    isPulling.value = true
  }

  function handleTouchMove(e) {
    if (!isPulling.value || isRefreshing.value) return
    
    const currentY = e.touches[0].clientY
    const distance = currentY - startY
    
    // Only allow pulling down
    if (distance > 0) {
      pullDistance.value = distance
      // Prevent native scroll when pulling
      if (distance > 10) {
        e.preventDefault()
      }
    }
  }

  function handleTouchEnd() {
    if (!isPulling.value) return
    
    if (pullDistance.value >= threshold) {
      isRefreshing.value = true
      onRefresh(() => {
        isRefreshing.value = false
        pullDistance.value = 0
      })
    } else {
      pullDistance.value = 0
    }
    
    isPulling.value = false
  }

  return {
    pullDistance,
    isPulling,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}
