/**
 * server/pty.js
 * Spawns a real PTY shell (PowerShell on Windows, bash on Unix)
 * and streams it bidirectionally over Socket.io.
 */

import os from 'os'
import pty from 'node-pty'

export function setupPty(io) {

  const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash')
  const shellArgs = os.platform() === 'win32' ? [] : []

  io.of('/terminal').on('connection', (socket) => {

    console.log(`[terminal] client connected: ${socket.id}`)

    const proc = pty.spawn(shell, shellArgs, {
      name: 'xterm-color',
      cols: 120,
      rows: 30,
      cwd: process.env.GRUDGE_CWD || process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-color',
        COLORTERM: 'truecolor',
      },
    })

    // Shell → browser
    proc.onData(data => socket.emit('data', data))

    proc.onExit(({ exitCode }) => {
      console.log(`[terminal] shell exited (code ${exitCode})`)
      socket.emit('data', `\r\n\x1b[33m[Shell exited with code ${exitCode}]\x1b[0m\r\n`)
      socket.disconnect()
    })

    // Browser → shell
    socket.on('data', (data) => proc.write(data))

    // Browser resize
    socket.on('resize', ({ cols, rows }) => {
      try { proc.resize(cols, rows) } catch {}
    })

    socket.on('disconnect', () => {
      console.log(`[terminal] client disconnected: ${socket.id}`)
      try { proc.kill() } catch {}
    })
  })
}
