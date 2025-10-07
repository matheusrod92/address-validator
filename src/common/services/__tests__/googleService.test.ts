import type { Mock } from "vitest";

import type { GoogleValidationResponse } from "@/common/services/googleService";
import { GoogleService } from "@/common/services/googleService";

global.fetch = vi.fn();

describe("GoogleService", () => {
	let googleService: GoogleService;

	beforeEach(() => {
		googleService = new GoogleService();
		vi.clearAllMocks();
	});

	const mockValidGoogleResponse: GoogleValidationResponse = {
		result: {
			verdict: {
				inputGranularity: "PREMISE",
				validationGranularity: "PREMISE",
				geocodeGranularity: "PREMISE",
				addressComplete: true,
				hasUnconfirmedComponents: false,
				hasInferredComponents: false,
				hasReplacedComponents: false,
			},
			address: {
				formattedAddress: "1600 Amphitheatre Parkway, Mountain View, CA 94043, USA",
				postalAddress: {
					regionCode: "US",
					languageCode: "en",
					postalCode: "94043",
					administrativeArea: "CA",
					locality: "Mountain View",
					addressLines: ["1600 Amphitheatre Parkway"],
				},
				addressComponents: [
					{
						componentName: { text: "1600", languageCode: "en" },
						componentType: "street_number",
						confirmationLevel: "CONFIRMED",
					},
					{
						componentName: { text: "Amphitheatre Parkway", languageCode: "en" },
						componentType: "route",
						confirmationLevel: "CONFIRMED",
					},
					{
						componentName: { text: "Mountain View", languageCode: "en" },
						componentType: "locality",
						confirmationLevel: "CONFIRMED",
					},
					{
						componentName: { text: "CA", languageCode: "en" },
						componentType: "administrative_area_level_1",
						confirmationLevel: "CONFIRMED",
					},
				],
			},
		},
	};

	describe("validateAddress", () => {
		it("returns VALID status for a confirmed address", async () => {
			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => mockValidGoogleResponse,
			});

			const result = await googleService.validateAddress("1600 Amphitheatre Parkway, Mountain View, CA 94043");

			expect(result.status).toBe("VALID");
			expect(result.standardized.number).toBe("1600");
			expect(result.standardized.street).toBe("Amphitheatre Parkway"); // Street name only, no number
			expect(result.standardized.city).toBe("Mountain View");
			expect(result.standardized.state).toBe("CA");
			expect(result.standardized.zip).toBe("94043");
			expect(result.corrections).toHaveLength(0);
			expect(result.warnings).toHaveLength(0);
		});

		it("returns CORRECTED status when components were replaced", async () => {
			const correctedResponse: GoogleValidationResponse = {
				...mockValidGoogleResponse,
				result: {
					...mockValidGoogleResponse.result,
					verdict: {
						...mockValidGoogleResponse.result.verdict,
						hasReplacedComponents: true,
					},
				},
			};

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => correctedResponse,
			});

			const result = await googleService.validateAddress("1600 Amphitheatre Pkwy, Mtn View, CA");

			expect(result.status).toBe("CORRECTED");
			expect(result.corrections).toContain("Address components were corrected or replaced");
		});

		it("returns UNVERIFIABLE status when address is incomplete", async () => {
			const incompleteResponse: GoogleValidationResponse = {
				...mockValidGoogleResponse,
				result: {
					...mockValidGoogleResponse.result,
					verdict: {
						...mockValidGoogleResponse.result.verdict,
						addressComplete: false,
					},
				},
			};

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => incompleteResponse,
			});

			const result = await googleService.validateAddress("123 Main St");

			expect(result.status).toBe("UNVERIFIABLE");
			expect(result.warnings).toContain("Address is incomplete");
		});

		it("returns UNVERIFIABLE status when components are suspicious", async () => {
			const suspiciousResponse: GoogleValidationResponse = {
				...mockValidGoogleResponse,
				result: {
					...mockValidGoogleResponse.result,
					verdict: {
						...mockValidGoogleResponse.result.verdict,
						hasUnconfirmedComponents: true,
					},
					address: {
						...mockValidGoogleResponse.result.address,
						addressComponents: [
							{
								componentName: { text: "1600", languageCode: "en" },
								componentType: "street_number",
								confirmationLevel: "UNCONFIRMED_AND_SUSPICIOUS",
							},
						],
					},
				},
			};

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => suspiciousResponse,
			});

			const result = await googleService.validateAddress("suspicious address");

			expect(result.status).toBe("UNVERIFIABLE");
			expect(result.warnings).toContain("Address contains suspicious components");
		});

		it("returns CORRECTED status with warnings for unconfirmed but plausible components", async () => {
			const plausibleResponse: GoogleValidationResponse = {
				...mockValidGoogleResponse,
				result: {
					...mockValidGoogleResponse.result,
					verdict: {
						...mockValidGoogleResponse.result.verdict,
						hasUnconfirmedComponents: true,
					},
					address: {
						...mockValidGoogleResponse.result.address,
						addressComponents: [
							{
								componentName: { text: "1600", languageCode: "en" },
								componentType: "street_number",
								confirmationLevel: "UNCONFIRMED_BUT_PLAUSIBLE",
							},
						],
					},
				},
			};

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => plausibleResponse,
			});

			const result = await googleService.validateAddress("1600 Main St");

			expect(result.status).toBe("CORRECTED");
			expect(result.warnings).toContain("Address contains unconfirmed but plausible components");
		});

		it("throws error when API request fails", async () => {
			(global.fetch as Mock).mockResolvedValue({
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: async () => "Invalid request",
			});

			await expect(googleService.validateAddress("invalid")).rejects.toThrow("Google API error");
		});

		it("throws error when network error occurs", async () => {
			(global.fetch as Mock).mockRejectedValue(new Error("Network error"));

			await expect(googleService.validateAddress("123 Main St")).rejects.toThrow("Network error");
		});
	});
});
