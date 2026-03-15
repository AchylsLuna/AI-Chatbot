import SupportTicket from "../Models/SupportTicketModel.js";

const normalizePlainText = (value) =>
    String(value || "")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .replace(/<[^>]*>/g, "")
        .trim();

export async function createSupportTicket(req, res) {
    try {
        const fullName = normalizePlainText(req.body?.fullName);
        const email = String(req.body?.email || "").trim().toLowerCase();
        const message = normalizePlainText(req.body?.message);

        const ticket = await SupportTicket.create({
            fullName,
            email,
            message,
            source: "landing_page",
        });

        return res.status(201).json({
            message: "Support request submitted successfully.",
            ticket: {
                id: String(ticket._id),
                status: ticket.status,
                createdAt: ticket.createdAt instanceof Date
                    ? ticket.createdAt.toISOString()
                    : new Date(ticket.createdAt).toISOString(),
            },
        });
    } catch (error) {
        console.error("Failed to create support ticket:", error);
        return res.status(500).json({ message: "Failed to submit support request." });
    }
}
