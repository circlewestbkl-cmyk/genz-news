<template>
  <div 
    class="swipe-container"
    @touchstart.passive="handleTouchStart"
    @touchmove.passive="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <slot />
    
    <!-- Swipe indicators -->
    <div v-if="showIndicators" class="swipe-indicators">
      <div 
        v-if="canSwipeLeft"
        class="swipe-indicator left"
        :class="{ active: swipeProgress < -0.3 }"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </div>
      <div 
        v-if="canSwipeRight"
        class="swipe-indicator right"
        :class="{ active: swipeProgress > 0.3 }"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSwipeGesture } from '../composables/useSwipeGesture'

const props = defineProps({
  showIndicators: {
    type: Boolean,
    default: true
  },
  canSwipeLeft: {
    type: Boolean,
    default: false
  },
  canSwipeRight: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['swipe-left', 'swipe-right', 'swipe-up', 'swipe-down'])

const swipeProgress = ref(0)

const { 
  handleTouchStart, 
  handleTouchMove, 
  handleTouchEnd, 
  handleTouchCancel,
  touchStart,
  touchEnd 
} = useSwipeGesture({
  onSwipeLeft: (data) => emit('swipe-left', data),
  onSwipeRight: (data) => emit('swipe-right', data),
  onSwipeUp: (data) => emit('swipe-up', data),
  onSwipeDown: (data) => emit('swipe-down', data),
  threshold: 50
})

// Update swipe progress for visual feedback
const updateProgress = () => {
  if (touchStart.value && touchEnd.value) {
    const deltaX = touchEnd.value.x - touchStart.value.x
    swipeProgress.value = deltaX / window.innerWidth
  }
}
</script>

<style scoped>
.swipe-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.swipe-indicators {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  pointer-events: none;
  display: flex;
  justify-content: space-between;
  padding: 0 1rem;
}

.swipe-indicator {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  opacity: 0;
  transition: all 0.2s ease;
}

.swipe-indicator.active {
  opacity: 1;
  transform: scale(1.1);
}

.swipe-indicator.left {
  transform: translateX(-20px);
}

.swipe-indicator.right {
  transform: translateX(20px);
}

.swipe-indicator.left.active {
  transform: translateX(0);
}

.swipe-indicator.right.active {
  transform: translateX(0);
}
</style>
