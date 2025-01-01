# Zhiyun Crane V2 Web Controller

A web-based Bluetooth controller for the Zhiyun Crane V2 gimbal. This proof-of-concept demonstrates basic directional control over the gimbal using the Web Bluetooth API.

## Features

- Browser-based control interface
- Real-time Bluetooth communication
- Directional controls (Up, Down, Left, Right)
- Command logging for debugging
- Clean, responsive UI

## Requirements

- Zhiyun Crane V2 gimbal (may work with other Crane models)
- Web browser with Bluetooth support (Chrome recommended)
- Device with Bluetooth capability

## Getting Started

1. Download the HTML file
2. Open it in a compatible web browser
3. Click "Connect to Gimbal"
4. Select your Crane V2 from the Bluetooth device list
5. Use the directional buttons to control the gimbal

## Technical Details

### Bluetooth Specifications

- Service UUID: `0000fee9-0000-1000-8000-00805f9b34fb`
- Characteristic UUID: `d44bc439-abfd-45a2-b575-925416129600`

### Control Commands

The gimbal accepts command packets in hex format. Current implemented commands:

```javascript
{
    'up':    [0x06, 0x10, 0x01, 0x0e, 0x89, 0xc2, 0xbc, 0x06, 0x10, 0x02, 0x08, 0x00, 0x31, 0xeb],
    'down':  [0x06, 0x10, 0x03, 0x08, 0x00, 0x06, 0xdb, 0x06, 0x10, 0x01, 0x01, 0x76, 0xcc, 0x72],
    'left':  [0x06, 0x10, 0x02, 0x08, 0x00, 0x31, 0xeb, 0x06, 0x10, 0x03, 0x01, 0x76, 0xa2, 0x12],
    'right': [0x06, 0x10, 0x02, 0x08, 0x00, 0x31, 0xeb, 0x06, 0x10, 0x03, 0x0d, 0xd9, 0xa3, 0x7a]
}
```

Each command is sent as a Uint8Array to the gimbal's characteristic.

### Command Structure

The command packets follow a specific structure, though full documentation is still in progress. Commands are sent every 200ms while a direction button is held.

## Known Limitations

- Not all axes are fully implemented
- Fine-grain control over speed/step size not yet available
- Limited testing with other Crane models
- Web Bluetooth API restrictions (HTTPS required for some browsers)

## Implementation Notes

The controller uses the Web Bluetooth API to establish a connection with the gimbal:

1. Connects to the gimbal's GATT server
2. Retrieves the primary service
3. Gets the characteristic for sending commands
4. Sends command packets while buttons are pressed

Commands are sent continuously while a button is held, with a 200ms delay between sends to prevent overwhelming the device.

## Contributing

This is a proof-of-concept project with room for improvement. Key areas for contribution:

- Additional axis support
- Speed/step size control implementation
- Command protocol documentation
- Support for other Crane models
- UI improvements

## Disclaimer

This is an unofficial project not affiliated with Zhiyun. Use at your own risk.
