/**
 * Itinerary Controller
 * ----------------------
 * Handles HTTP request/response logic for itinerary generation endpoints.
 * Delegates business logic to itineraryService.
 */

import {
  generateItinerary,
  saveItineraryToFirestore,
  regenerateItinerary,
} from "../services/itineraryService.js";
import { generatePhotoChallenges } from "../services/challengeService.js";
import { db } from "../config/firebase.js";

/**
 * POST /generate-itinerary
 *
 * Generates a new AI-powered itinerary and optionally saves it to Firestore.
 */
export async function handleGenerateItinerary(req, res) {
  try {
    const { destination, days, preference, budget, userId, arrivalDate, returnDate } = req.body;

    console.log(
      "🗺️ ITINERARY HIT:",
      destination,
      "| Days:",
      days,
      "| Pref:",
      preference,
      "| Budget:",
      budget
    );

    // Input validation
    if (!destination) {
      return res.status(400).json({ error: "Destination is required" });
    }

    // Generate the itinerary via AI
    const itinerary = await generateItinerary({
      destination,
      days: days || 3,
      preference: preference || "Adventure",
      budget: budget || 30000,
    });

    // If userId is provided, save to Firestore
    let tripId = null;
    if (userId) {
      tripId = await saveItineraryToFirestore(
        userId,
        { destination, days, budget, preference, arrivalDate, returnDate },
        itinerary,
        db
      );

      // Auto-generate photo challenges for this destination (async, fire-and-forget)
      generatePhotoChallenges(userId, destination, itinerary.days, db)
        .catch(err => console.warn("⚠️ Challenge generation failed (non-fatal):", err.message));
    }

    res.json({
      ...itinerary,
      tripId,
    });
  } catch (error) {
    console.error("❌ Itinerary generation error:", error);
    res.status(500).json({ error: "Itinerary generation failed" });
  }
}

/**
 * POST /regenerate-itinerary
 *
 * Regenerates the itinerary for an existing trip.
 */
export async function handleRegenerateItinerary(req, res) {
  try {
    const { tripId } = req.body;

    if (!tripId) {
      return res.status(400).json({ error: "Trip ID is required" });
    }

    const newItinerary = await regenerateItinerary(tripId, db);

    res.json(newItinerary);
  } catch (error) {
    console.error("❌ Regeneration error:", error);
    res.status(500).json({ error: "Itinerary regeneration failed" });
  }
}
