import express from "express";
import { createServer as createViteServer } from "vite";
import Stripe from "stripe";
import path from "path";
import { Readable } from "stream";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import nodemailer from "nodemailer";

// Initialize firebase-admin on the server-side to perform secure operations
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId
  });
}
const dbAdmin = getFirestore();

// Helper to send email via Resend, SMTP (Nodemailer), or fallback simulation with Firestore logging
async function sendSystemEmail({
  to,
  subject,
  text,
  html,
  from,
  replyTo,
  category = "transactional"
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
  category?: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const fromAddress = from || process.env.EMAIL_FROM || 'Godley Ciders <hello@godleyciders.com>';

  let providerUsed = "simulated";
  let deliveryStatus: "delivered" | "simulated" | "failed" = "simulated";
  let errorMessage: string | null = null;
  let responseData: any = null;

  try {
    if (resendKey) {
      providerUsed = "resend";
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [to],
          reply_to: replyTo || 'billing@godleyciders.com',
          subject: subject,
          text: text,
          html: html || text.replace(/\n/g, '<br/>')
        })
      });

      const resBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resBody.message || resBody.error || `Resend HTTP error ${response.status}`);
      }
      deliveryStatus = "delivered";
      responseData = resBody;
      console.log(`[EMAIL DISPATCH - RESEND SUCCESS] Sent to: ${to} | Subject: ${subject}`);
    } else if (smtpHost) {
      providerUsed = "smtp";
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        }
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: to,
        replyTo: replyTo || 'billing@godleyciders.com',
        subject: subject,
        text: text,
        html: html || text.replace(/\n/g, '<br/>')
      });
      deliveryStatus = "delivered";
      responseData = { messageId: info.messageId };
      console.log(`[EMAIL DISPATCH - SMTP SUCCESS] Sent to: ${to} | MsgId: ${info.messageId}`);
    } else {
      providerUsed = "simulated";
      deliveryStatus = "simulated";
      console.log(`[EMAIL DISPATCH - SIMULATED LOG] To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Content:\n${text}`);
    }
  } catch (err: any) {
    deliveryStatus = "failed";
    errorMessage = err.message || "Email transport failure";
    console.error(`[EMAIL DISPATCH - ERROR] Failed sending to ${to}:`, err);
  }

  // Always write an audit record to Firestore email_logs collection
  try {
    await dbAdmin.collection("email_logs").add({
      to,
      from: fromAddress,
      subject,
      textPreview: text.substring(0, 300),
      fullText: text,
      html: html || null,
      provider: providerUsed,
      status: deliveryStatus,
      errorMessage,
      category,
      responseData: responseData || null,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (dbErr) {
    console.warn("Failed to write to email_logs in Firestore:", dbErr);
  }

  return {
    success: deliveryStatus !== "failed",
    provider: providerUsed,
    status: deliveryStatus,
    error: errorMessage
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Integration API: Outbound Synchronization Queue for Local App
  let syncQueue: any[] = [];

  // Middleware to parse JSON bodies
  app.use(express.json());

  // API Route for Google Drive Video Range Proxying to enable smooth seeking and scrubbing
  app.get("/api/video-proxy", async (req, res) => {
    try {
      const { id } = req.query;
      if (!id || typeof id !== "string") {
        return res.status(400).send("Missing parameter: id");
      }

      const reqHeaders: Record<string, string> = {};
      if (req.headers.range) {
        reqHeaders["Range"] = req.headers.range;
      }

      // Standard browser user-agent to avoid Drive automated-bot detection
      reqHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

      // 1. Initial attempt to fetch the file
      const driveUrl = `https://drive.google.com/uc?export=download&id=${id}`;
      let driveResponse = await fetch(driveUrl, {
        headers: reqHeaders,
      });

      // 2. If it returns an HTML warning instead of the raw media asset stream, download bypass is needed
      const initialContentType = driveResponse.headers.get("content-type") || "";
      if (initialContentType.includes("text/html")) {
        const html = await driveResponse.text();
        const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);

        if (confirmMatch && confirmMatch[1]) {
          const confirmToken = confirmMatch[1];
          // Extrapolate and assemble authorization cookies returned by Drive
          const setCookieHeaders = (driveResponse.headers as any).getSetCookie 
            ? (driveResponse.headers as any).getSetCookie() 
            : (driveResponse.headers.get("set-cookie") ? [driveResponse.headers.get("set-cookie")!] : []);
          
          const cookies = setCookieHeaders.map((c: string) => c.split(";")[0]).join("; ");

          const confirmedUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${id}`;
          
          const secondHeaders: Record<string, string> = { ...reqHeaders };
          if (cookies) {
            secondHeaders["Cookie"] = cookies;
          }

          driveResponse = await fetch(confirmedUrl, {
            headers: secondHeaders,
          });
        } else {
          // Alternative fallback
          const fallbackUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${id}`;
          driveResponse = await fetch(fallbackUrl, {
            headers: reqHeaders,
          });
        }
      }

      const contentType = driveResponse.headers.get("content-type") || "video/mp4";
      const contentLength = driveResponse.headers.get("content-length");
      const contentRange = driveResponse.headers.get("content-range");
      const acceptRanges = "bytes";

      res.status(driveResponse.status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Accept-Ranges", acceptRanges);

      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }
      if (contentRange) {
        res.setHeader("Content-Range", contentRange);
      }

      // Permitted CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range");

      if (driveResponse.body) {
        Readable.fromWeb(driveResponse.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error("Video proxy error:", err);
      if (!res.headersSent) {
        res.status(500).send("Video stream proxy failed");
      }
    }
  });

  // API Route for Stripe Checkout (Generic store/club and cart purchases)
  app.post("/api/checkout", async (req, res) => {
    try {
      const { items, metadata } = req.body; // array of items from the cart { name, quantity, price }

      const token = process.env.STRIPE_SECRET_KEY;

      if (!token) {
        return res.status(400).json({ error: "STRIPE_SECRET_KEY is missing. Please configure it in the platform Environment Variables." });
      }

      const stripe = new Stripe(token);

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items in the cart." });
      }

      const lineItems = items.map((item: any) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

      const origin = req.headers.origin || req.headers.referer || `http://localhost:${PORT}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        metadata: metadata || {},
        success_url: `${origin}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}?checkout=cancel`,
      });

      if (session.url) {
        res.json({ url: session.url });
      } else {
        throw new Error("Failed to create Stripe checkout session");
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Checkout failed" });
    }
  });

  // API Route to settle a specific Wholesale Purchase Order Invoice online
  app.post("/api/checkout/wholesale-invoice", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "Missing orderId" });
      }

      const token = process.env.STRIPE_SECRET_KEY;
      if (!token) {
        return res.status(400).json({ error: "STRIPE_SECRET_KEY is missing. Please configure it in the platform Environment Variables." });
      }

      const stripe = new Stripe(token);

      // Sourced from admin privileged Firestore
      const orderDoc = await dbAdmin.collection("orders").doc(orderId).get();
      if (!orderDoc.exists) {
        return res.status(404).json({ error: "Wholesale order record not found" });
      }

      const orderData = orderDoc.data();
      if (!orderData) {
        return res.status(400).json({ error: "Order dataset is empty" });
      }

      const hasItemsList = Array.isArray(orderData.items) && orderData.items.length > 0;
      let lineItems: any[] = [];

      if (hasItemsList) {
        lineItems = orderData.items.map((item: any) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name || 'Commercial Cider Allocation',
            },
            unit_amount: item.unitPriceCents || Math.round(item.price * 100) || 0,
          },
          quantity: item.quantity || 1,
        }));

        if (orderData.shippingCents && orderData.shippingCents > 0) {
          lineItems.push({
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'LTL Freight & Pallet Delivery Fee',
              },
              unit_amount: orderData.shippingCents,
            },
            quantity: 1,
          });
        }
      } else {
        lineItems = [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice Payment - PO #${orderData.orderId || 'Allocation'}`,
            },
            unit_amount: orderData.totalCents || 0,
          },
          quantity: 1,
        }];
      }

      const origin = req.headers.origin || req.headers.referer || `http://localhost:${PORT}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'us_bank_account'],
        line_items: lineItems,
        mode: 'payment',
        metadata: {
          type: "wholesale_invoice_payment",
          orderId: orderId,
          userEmail: orderData.customerEmail || ''
        },
        success_url: `${origin}/wholesale?checkout=success&session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
        cancel_url: `${origin}/wholesale?checkout=cancel`,
      });

      if (session.url) {
        res.json({ url: session.url });
      } else {
        throw new Error("Failed to generate invoice checkout session link");
      }
    } catch (error: any) {
      console.error("Wholesale payment setup error:", error);
      res.status(500).json({ error: error.message || "Failed to initialize invoice payment session" });
    }
  });

  // Secure Server-Verified Status validation to prevent client-side intercept spoofing
  app.get("/api/checkout/session-status", async (req, res) => {
    try {
      const sessionId = req.query.session_id;
      if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: "Missing session_id" });
      }

      const token = process.env.STRIPE_SECRET_KEY;
      if (!token) {
        return res.status(400).json({ error: "STRIPE_SECRET_KEY is missing." });
      }

      const stripe = new Stripe(token);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid' || session.status === 'complete') {
        const metadata = session.metadata || {};
        const { type } = metadata;

        if (type === 'wholesale_invoice_payment') {
          const { orderId } = metadata;
          if (orderId) {
            const orderRef = dbAdmin.collection("orders").doc(orderId);
            await orderRef.update({
              status: "paid",
              updatedAt: FieldValue.serverTimestamp()
            });

            console.log(`[Stripe Sync] Wholesale purchase order ${orderId} marked as PAID.`);

            // Enqueue synchronization event for local BevForge Terminal
            const orderDoc = await orderRef.get();
            const orderData = orderDoc.data();
            
            // Queue sync event in memory
            syncQueue.push({
              eventId: 'evt-' + Math.random().toString(36).substring(2, 10),
              eventType: 'wholesale.invoice_paid',
              createdAt: new Date().toISOString(),
              data: {
                orderId: orderData?.orderId || orderId,
                firebaseId: orderId,
                totalCents: orderData?.totalCents || 0,
                businessName: orderData?.businessName || '',
                timestamp: new Date().toISOString()
              }
            });

            if (orderData && orderData.customerEmail) {
              // Dispatch confirmation receipt email asynchronously
              try {
                const response = await fetch(`${req.protocol}://${req.get('host') || 'localhost:3000'}/api/email/dispatch`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    to: orderData.customerEmail,
                    from: 'billing@godleyciders.com',
                    subject: `Payment Confirmed - Purchase Order ${orderData.orderId || orderId}`,
                    text: `Hello ${orderData.customerName || 'Commercial Partner'},\n\nWe have successfully processed your card payment of $${((orderData.totalCents || 0) / 100).toFixed(2)} for Purchase Order ${orderData.orderId || orderId}.\n\nInvoice balance: settled.\nOur distribution warehouse has cleared your allocation release coordinates.\n\nCheers,\nGodley Ciders Sales Desk`
                  })
                });
                if (!response.ok) console.warn("Email notify returned non-2xx status");
              } catch (err) {
                console.warn("Could not dispatch email notice asynchronously:", err);
              }
            }
          }
        } else if (type === 'club_subscription_signup') {
          const { email, tier } = metadata;
          if (email) {
            const clubLeadsRef = dbAdmin.collection("club_leads");
            const snapshot = await clubLeadsRef.where("email", "==", email).get();
            if (!snapshot.empty) {
              for (const docSnap of snapshot.docs) {
                await docSnap.ref.update({
                  status: "active",
                  stripeSessionId: sessionId,
                  updatedAt: FieldValue.serverTimestamp()
                });
                console.log(`[Stripe Sync] Club member pass (${email}) successfully activated.`);
              }
            }

            // Create in-app admin alert
            await dbAdmin.collection("admin_notifications").add({
              type: "club_paid",
              title: `🎉 Club Membership Activated - ${tier || 'Club'}`,
              customerEmail: email,
              tier: tier || 'Club',
              sessionId: sessionId,
              read: false,
              createdAt: FieldValue.serverTimestamp()
            }).catch(e => console.warn(e));

            // Send notification to Godley Ciders Billing & Sales Desk
            const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'billing@godleyciders.com';
            await sendSystemEmail({
              to: adminEmail,
              subject: `🎉 New Paid Club Member Activated (${email})`,
              text: `Godley Ciders Sales Desk,\n\nA new club member has completed their paid Stripe checkout!\n\nEmail: ${email}\nTier: ${tier || 'Club'}\nStripe Session: ${sessionId}\nStatus: Active\n\nCheers,\nGodley Automation`,
              category: "admin_alert"
            });
          }
        }

        return res.json({ status: "paid", metadata });
      }

      res.json({ status: session.payment_status });
    } catch (error: any) {
      console.error("Session verification failure:", error);
      res.status(500).json({ error: error.message || "Failed to authenticate Stripe session credentials" });
    }
  });

  // Analytics Tracking Endpoint
  app.post("/api/analytics/log-visit", async (req, res) => {
    try {
      const { pathname, sessionId, referrer, userAgent } = req.body;
      if (!pathname) {
        return res.status(400).json({ error: "Missing pathname" });
      }

      const logRef = dbAdmin.collection("visitor_logs").doc();
      await logRef.set({
        pathname,
        sessionId: sessionId || "unknown",
        referrer: referrer || "",
        userAgent: userAgent || "",
        ip: req.ip || "",
        createdAt: FieldValue.serverTimestamp()
      });

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Log visit error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Analytics Metrics API (Provides real-time stats for the Master Admin panel)
  app.get("/api/analytics/metrics", async (req, res) => {
    try {
      const visitorLogsSnapshot = await dbAdmin.collection("visitor_logs").get();
      const clubLeadsSnapshot = await dbAdmin.collection("club_leads").get();
      const ordersSnapshot = await dbAdmin.collection("orders").get();
      const inquiriesSnapshot = await dbAdmin.collection("wholesale_inquiries").get();
      const reservationsSnapshot = await dbAdmin.collection("shop_reservations").get();

      const totalPageviews = visitorLogsSnapshot.size;
      
      const sessions = new Set<string>();
      visitorLogsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.sessionId) sessions.add(data.sessionId);
      });
      const uniqueVisits = sessions.size;

      const totalSignups = clubLeadsSnapshot.size;
      const totalInquiries = inquiriesSnapshot.size;
      const totalReservations = reservationsSnapshot.size;
      const totalOrdersCount = ordersSnapshot.size;

      let totalRevenueCents = 0;
      let paidOrdersCount = 0;
      const recentOrders: any[] = [];

      ordersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'paid' || data.status === 'fulfilled') {
          paidOrdersCount++;
          const cents = data.totalCents || Math.round((data.totalAmount || 0) * 100);
          totalRevenueCents += cents;
        }
        recentOrders.push({
          id: doc.id,
          orderId: data.orderId || doc.id.substring(0, 8),
          customerName: data.customerName || data.businessName || "Web Client",
          customerEmail: data.customerEmail || data.email || "",
          total: (data.totalCents || Math.round((data.totalAmount || 0) * 100)) / 100,
          status: data.status || "pending",
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString()
        });
      });

      // Sort recent orders by date
      recentOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Path breakdown (Page views per path)
      const pathViews: Record<string, number> = {};
      visitorLogsSnapshot.forEach(doc => {
        const data = doc.data();
        const p = data.pathname || "/";
        pathViews[p] = (pathViews[p] || 0) + 1;
      });

      // Daily trend (last 7 days pageviews & visits)
      const dailyTrend: Record<string, { pageviews: number, visits: Set<string> }> = {};
      visitorLogsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.createdAt) {
          const dateStr = data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
          if (!dailyTrend[dateStr]) {
            dailyTrend[dateStr] = { pageviews: 0, visits: new Set() };
          }
          dailyTrend[dateStr].pageviews++;
          if (data.sessionId) dailyTrend[dateStr].visits.add(data.sessionId);
        }
      });

      const trendArray = Object.keys(dailyTrend).map(date => ({
        date,
        pageviews: dailyTrend[date].pageviews,
        visits: dailyTrend[date].visits.size
      })).slice(-7);

      res.status(200).json({
        pageviews: totalPageviews,
        visits: uniqueVisits,
        signups: totalSignups,
        inquiries: totalInquiries,
        reservations: totalReservations,
        ordersCount: totalOrdersCount,
        paidOrdersCount,
        revenue: totalRevenueCents / 100,
        pathBreakdown: pathViews,
        recentOrders: recentOrders.slice(0, 10),
        dailyTrend: trendArray
      });
    } catch (error: any) {
      console.error("Fetch metrics error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Integration API: Inbound Webhook from Local App
  // Point your local app's webhooks to POST https://<your-app-domain>/api/webhooks/sync
  app.post("/api/webhooks/sync", async (req, res) => {
    try {
      const payload = req.body;
      const eventType = req.headers["x-event-type"] || "unknown";
      
      console.log(`[Webhook Received] Event: ${eventType}`, payload);
      
      // Here you would typically process the incoming data,
      // update Firebase Firestore, or update a local database representing
      // the web-accessible view of the user data (CRM / Logistics)

      res.status(200).json({ success: true, message: "Webhook received successfully" });
    } catch (error: any) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: error.message || "Failed to process webhook" });
    }
  });

  // Integration API: Outbound Synchronization Queue for Local App
  // Endpoint for the Web App frontend or external services (like Stripe webhooks) to submit events
  app.post("/api/events/enqueue", async (req, res) => {
    try {
      const event = req.body; // Expects a WebhookEvent payload
      console.log(`[Event Queued] Type: ${event.eventType}`, event.eventId);
      
      // Enqueue the event for BevForge to pull
      syncQueue.push({
        ...event,
        queuedAt: new Date().toISOString()
      });

      res.status(200).json({ success: true, message: "Event queued for sync." });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to enqueue event" });
    }
  });

  // Simulated endpoint for the Web App frontend to submit changes (e.g., new wholesale orders)
  app.post("/api/orders", async (req, res) => {
    try {
      const order = req.body;
      console.log("New order received from web client:", order);
      
      const eventId = crypto.randomUUID?.() || Math.random().toString(36).substring(7);
      
      // Queue it for the local app to pull later
      syncQueue.push({
        eventId,
        eventType: "order.created",
        createdAt: new Date().toISOString(),
        idempotencyKey: eventId,
        data: order
      });

      res.status(200).json({ success: true, message: "Order placed and queued for sync." });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to submit order" });
    }
  });

  // Endpoint for the Local App to poll when it comes online, fetching all queued updates.
  app.get("/api/sync/pull", async (req, res) => {
    try {
      // Provide only unacknowledged events (in this basic implementation, all current elements in the queue)
      const batch = [...syncQueue];
      
      console.log(`[Sync Pull] Local app fetched ${batch.length} updates.`);
      res.status(200).json({ updates: batch });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to pull sync queue" });
    }
  });

  // Endpoint for BevForge to acknowledge processed events
  app.post("/api/sync/ack", async (req, res) => {
    try {
      const { eventIds } = req.body;
      if (!Array.isArray(eventIds)) {
         return res.status(400).json({ error: "eventIds must be an array" });
      }

      console.log(`[Sync Ack] BevForge acknowledging events:`, eventIds);

      let ackCount = 0;
      // Remove acknowledged events from the durable queue
      syncQueue = syncQueue.filter(evt => {
        if (eventIds.includes(evt.eventId)) {
           ackCount++;
           return false; // Remove from queue
        }
        return true; // Keep in queue
      });

      res.status(200).json({ success: true, acknowledged: ackCount });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to acknowledge events" });
    }
  });

  // Email Dispatch Endpoint
  app.post("/api/email/dispatch", async (req, res) => {
    try {
      const { to, subject, text, html, from, replyTo, category, notifyAdmin, adminSubject, adminText, adminData } = req.body;
      if (!to || !subject) {
        return res.status(400).json({ error: "Missing required email fields (to, subject)" });
      }

      // 1. Send recipient email
      const result = await sendSystemEmail({
        to,
        subject,
        text: text || "",
        html,
        from,
        replyTo,
        category: category || "customer_notification"
      });

      // 2. If notifyAdmin is enabled or adminSubject/adminText is supplied, send alert to Godley Ciders admin
      let adminResult = null;
      if (notifyAdmin || adminSubject || adminText) {
        const adminRecipient = process.env.ADMIN_NOTIFICATION_EMAIL || 'billing@godleyciders.com';
        const finalAdminSubj = adminSubject || `🚨 [Godley Alert] ${subject}`;
        const finalAdminText = adminText || `Godley Ciders Sales Desk Alert:\n\nA customer notification was dispatched to ${to}.\n\nSubject: ${subject}\n\nMessage Transcript:\n${text}\n\n---\nGodley Ciders Automated Monitor`;
        
        adminResult = await sendSystemEmail({
          to: adminRecipient,
          subject: finalAdminSubj,
          text: finalAdminText,
          category: "admin_alert"
        });

        // Also record an in-app admin notification
        try {
          await dbAdmin.collection("admin_notifications").add({
            type: category || "general_alert",
            title: finalAdminSubj,
            recipient: to,
            message: finalAdminText,
            adminData: adminData || null,
            read: false,
            createdAt: FieldValue.serverTimestamp()
          });
        } catch (e) {
          console.warn("Failed to write to admin_notifications:", e);
        }
      }

      res.status(200).json({
        success: result.success,
        provider: result.provider,
        status: result.status,
        recipient: to,
        adminNotified: !!adminResult?.success,
        error: result.error
      });
    } catch (err: any) {
      console.error("Email dispatch failed:", err);
      res.status(500).json({ error: "Failed to process email", details: err.message });
    }
  });

  // Test Email Endpoint (for Master Admin verification)
  app.post("/api/email/test", async (req, res) => {
    try {
      const { targetEmail } = req.body;
      const recipient = targetEmail || process.env.ADMIN_NOTIFICATION_EMAIL || 'billing@godleyciders.com';
      
      const testResult = await sendSystemEmail({
        to: recipient,
        subject: "🍷 Godley Ciders - Test Dispatch Verification",
        text: `Hello Godley Ciders Team,\n\nThis is an automated confirmation test message from your Godley Ciders Master Admin Terminal.\n\nTimestamp: ${new Date().toISOString()}\nEnvironment: ${process.env.NODE_ENV || 'development'}\nProvider: ${process.env.RESEND_API_KEY ? 'Resend API' : process.env.SMTP_HOST ? `SMTP (${process.env.SMTP_HOST})` : 'Audit Log System'}\n\nIf you are reading this in your inbox, your email transport system is fully operational and ready to send customer release tickets and instant club signup alerts!\n\nCheers,\nGodley Ciders Dispatch Bot`,
        category: "test_verification"
      });

      res.json({
        success: testResult.success,
        provider: testResult.provider,
        status: testResult.status,
        recipient,
        error: testResult.error
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Email Status & Diagnostics Endpoint
  app.get("/api/email/status", async (req, res) => {
    try {
      const resendConfigured = Boolean(process.env.RESEND_API_KEY);
      const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
      const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'billing@godleyciders.com';

      // Fetch recent 25 email logs from Firestore
      let recentLogs: any[] = [];
      try {
        const logsSnap = await dbAdmin.collection("email_logs").orderBy("createdAt", "desc").limit(25).get();
        recentLogs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.warn("Could not query email_logs:", e);
      }

      res.json({
        resendConfigured,
        smtpConfigured,
        smtpHost: process.env.SMTP_HOST ? `${process.env.SMTP_HOST}:${process.env.SMTP_PORT || '587'}` : null,
        adminEmail,
        activeMode: resendConfigured ? "Resend API" : smtpConfigured ? "SMTP Transport" : "Audit Log Queue (Simulation)",
        recentLogs
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
