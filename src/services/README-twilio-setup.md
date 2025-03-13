# Twilio WhatsApp Verification Service

This service provides phone number verification via WhatsApp and SMS using Twilio.

## Setup Instructions

### 1. Install Required Dependencies

```bash
npm install twilio
```

### 2. Twilio Account Setup

1. Create a Twilio account at [https://www.twilio.com/](https://www.twilio.com/)
2. Get your Account SID and Auth Token from the Twilio Console Dashboard
3. Set up a WhatsApp Sender by following Twilio's WhatsApp API setup guide
4. Create a Verify Service for SMS verification (optional, only needed for SMS verification)

### 3. Environment Variables

Add the following environment variables to your `.env` file:

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_sid
TWILIO_WHATSAPP_FROM_NUMBER=your_whatsapp_number
```

### 4. Update the Twilio Service

Once you've installed the Twilio package, update the `twilio.ts` file to use the actual Twilio client instead of the placeholder:

```typescript
import { Twilio } from "twilio";
// ...

export class TwilioService {
  private client: Twilio;
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
    this.client = new Twilio(config.accountSid, config.authToken);
  }
  // ...
}
```

## API Endpoints

### WhatsApp Verification

#### Send Verification Code via WhatsApp

```
POST /auth/verification/whatsapp/send
```

Request body:

```json
{
  "phoneNumber": "+919876543210"
}
```

Response:

```json
{
  "success": true,
  "message": "Verification code sent via WhatsApp",
  "data": {
    "success": true,
    "message": "Verification code sent via WhatsApp",
    "phoneNumber": "+919876543210"
  }
}
```

#### Verify WhatsApp OTP

```
POST /auth/verification/whatsapp/verify
```

Request body:

```json
{
  "phoneNumber": "+919876543210",
  "code": "123456"
}
```

Response:

```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "data": {
    "success": true,
    "message": "Phone number verified successfully",
    "phoneNumber": "+919876543210"
  }
}
```

### SMS Verification (Alternative)

#### Send Verification Code via SMS

```
POST /auth/verification/sms/send
```

Request body:

```json
{
  "phoneNumber": "+919876543210"
}
```

Response:

```json
{
  "success": true,
  "message": "Verification code sent via SMS",
  "data": {
    "success": true,
    "message": "Verification code sent via SMS",
    "phoneNumber": "+919876543210"
  }
}
```

#### Verify SMS Code

```
POST /auth/verification/sms/verify
```

Request body:

```json
{
  "phoneNumber": "+919876543210",
  "code": "123456"
}
```

Response:

```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "data": {
    "success": true,
    "message": "Phone number verified successfully",
    "phoneNumber": "+919876543210"
  }
}
```

## Usage Example

```javascript
// Client-side example using fetch
async function sendWhatsAppVerification(phoneNumber) {
  try {
    const response = await fetch("/auth/verification/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error sending verification:", error);
    throw error;
  }
}

async function verifyWhatsAppCode(phoneNumber, code) {
  try {
    const response = await fetch("/auth/verification/whatsapp/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phoneNumber, code }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error verifying code:", error);
    throw error;
  }
}
```

## Notes

- The WhatsApp verification uses a custom OTP generation and storage approach, while the SMS verification uses Twilio's Verify API.
- WhatsApp verification requires the user to have WhatsApp installed and the number to be registered with WhatsApp.
- For production use, consider implementing rate limiting to prevent abuse.
- The phone number formatting assumes Indian numbers by default (adding +91 prefix). Modify the `formatPhoneNumber` method if you need to support other countries.
