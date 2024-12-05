#!/usr/bin/env node

const { spawn } = require('child_process')
const waitOn = require('wait-on')

const MAX_WAIT_TIME = 3 * 60 * 1000
console.log('Starting the backend (LARS) and frontend...')

// Start the backend (LARS)
const backend = spawn('npm', ['run', 'backend'], {
  stdio: 'inherit' // Keeps LARS interactive for input/output
})

// Listen for backend readiness using `wait-on`
const waitForBackend = () => {
  console.log('Waiting for the backend to be ready at http://localhost:8080...')
  waitOn(
    {
      resources: ['http://localhost:8080'], // Replace with actual backend URL
      timeout: MAX_WAIT_TIME
    },
    (err) => {
      if (err) {
        console.error('Error waiting for backend readiness:', err)
        process.exit(1)
      }
      console.log('Backend is ready! Starting the frontend...')
      startFrontend()
    }
  )
}

// Start the frontend process
const startFrontend = () => {
  const frontend = spawn('npm', ['run', 'frontend'], {
    stdio: 'inherit' // Forward frontend output to the terminal
  })

  frontend.on('close', (code) => {
    if (code !== 0) {
      console.error(`Frontend process exited with code ${code}`)
      process.exit(code)
    }
  })
}

// Call `waitForBackend` after a slight delay to allow `lars` to initialize
setTimeout(waitForBackend, 1000)

backend.on('close', (code) => {
  if (code !== 0) {
    console.error(`Backend process exited with code ${code}`)
    process.exit(code)
  }
})