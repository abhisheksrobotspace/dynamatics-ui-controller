# Dynamatics TG17 Hydraulic Test Rig - HMI Touchscreen UI

Production HMI Touchscreen application for the **Dynamatics TG17 Hydraulic Test Rig**, designed for the **ioWare Pro 100** industrial controller running **iFactory OS**.

---

## Features
- **ioX 1, 2, 3 Multi-Board Solenoid Controls:** Interactive industrial rocker switch controls for all 18 test rig solenoids (K1–K18) with safety PIN lock protection (`1478953`).
- **Interactive Discrete Input Monitoring:** Real-time visual status and manual tap-toggle simulation for E-Stop Aux Contact (`DI1` Normally Closed / Healthy indicator), Safety Light Curtain (`DI4`), and Motor Coupling Proximity Sensor (`DI8`).
- **Live Diagnostic & Sensor Dashboard:** Real-time RS-485 Modbus telemetry:
  - Selec MFM384-C 3-Phase Energy Meter ($V_1..V_3$, $I_1..I_3$, Total Active Power kW, 50 Hz mains)
  - Selec PID500 Process Oil Temperature ($0.1^\circ\text{C}$ resolution)
  - Dual 400 bar Pressure Transducers (Front & Rear PT5400)
  - Dual Flowmeters (Front & Rear 1000 ppr) & High-Speed RPM Calculation
- **20-Stage Automated Test Workflow View:** Visual step-by-step state machine execution monitor.

---

## Repository Structure
```
dynamatics-test-rig-ui/
├── packages/
│   ├── lib-ifactory-os-v2/        # Core iFactory OS HMI Application
│   │   ├── src/io-app/            # Dynamatics Test Rig App Views & Store
│   │   │   ├── routes/Home.svelte # Main I/O & Diagnostics Screen
│   │   │   ├── components/        # IoToggle, IoStatus, RigSensorsView, RigAutoTestView
│   │   │   └── lib/               # io-store.svelte.ts, io-hardware.ts, io-topics.ts
│   │   └── package.json
│   └── lib-ifactory-ui-v2/        # Shared iFactory Design System Component Library
├── package.json                   # Root monorepo workspace configuration
└── README.md
```

---

## Building and Flashing onto a New Device

### 1. Prerequisites on Build Machine
- Node.js $\ge 20$
- npm $\ge 10$

### 2. Install & Build
```bash
# Clone the repository
git clone git@github.com:abhisheksrobotspace/dynamatics-test-rig-ui.git
cd dynamatics-test-rig-ui

# Install dependencies across packages
npm install

# Build the ioWare static distribution
npm run build:ioware
```
The production bundle is generated at:
`packages/lib-ifactory-os-v2/build/`

---

## Flashing / Deploying to ioWare Pro 100 (Fresh iFactory OS Image)

On any fresh ioWare Pro 100 device running iFactory OS, the UI is statically hosted at `/home/rs/apps/ifactory-os/`:

```bash
# Set device IP address (default: 192.168.2.180)
export IOWARE_IP=192.168.2.180

# Deploy via rsync
rsync -avz packages/lib-ifactory-os-v2/build/ rs@$IOWARE_IP:/home/rs/apps/ifactory-os/

# Reload Nginx web server and restart Electron kiosk on the device
ssh rs@$IOWARE_IP "sudo systemctl reload nginx && sudo supervisorctl restart electron-app"
```

### Unlocking Relay Controls on the Screen
- To actuate solenoids from the touchscreen, tap **Enable Control** (or tap any output switch).
- Default Factory PIN: **`1478953`**.
