import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(router)

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('SW registered: ', registration)
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                // Show update notification
                console.log('New content available, please refresh!')
              }
            })
          }
        })
      },
      (error) => {
        console.log('SW registration failed: ', error)
      }
    )
  })
}

// Prevent pull-to-refresh on mobile
let lastTouchEnd = 0
document.addEventListener('touchend', (event) => {
  const now = Date.now()
  if (now - lastTouchEnd <= 300) {
    event.preventDefault()
  }
  lastTouchEnd = now
}, false)

// Handle viewport resize for mobile keyboards
if (typeof window !== 'undefined') {
  const originalHeight = window.innerHeight
  
  window.addEventListener('resize', () => {
    const currentHeight = window.innerHeight
    const difference = originalHeight - currentHeight
    
    // If keyboard is open (height reduced by more than 150px)
    if (difference > 150) {
      document.body.classList.add('keyboard-open')
    } else {
      document.body.classList.remove('keyboard-open')
    }
  })
}

app.mount('#app')
