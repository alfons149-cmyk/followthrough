export async function sendViaResend(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      replyTo: args.replyTo,
    }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) { 
    throw new Error(`Resend error ${res.status}: ${JSON.stringify(json)}`); 
  }

  return json as { id?: string };
}
