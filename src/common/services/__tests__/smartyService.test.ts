import type { Mock } from "vitest";

import type { SmartyValidationResponse } from "@/common/services/smartyService";
import { SmartyService } from "@/common/services/smartyService";

global.fetch = vi.fn();

describe("SmartyService", () => {
	let smartyService: SmartyService;

	beforeEach(() => {
		smartyService = new SmartyService();
		vi.clearAllMocks();
	});

	const mockValidSmartyResponse: SmartyValidationResponse = [
		{
			delivery_line_1: "1600 Amphitheatre Pkwy",
			last_line: "Mountain View CA 94043-1351",
			components: {
				primary_number: "1600",
				street_name: "Amphitheatre",
				street_suffix: "Pkwy",
				city_name: "Mountain View",
				state_abbreviation: "CA",
				zipcode: "94043",
				plus4_code: "1351",
			},
			metadata: {
				record_type: "S",
				zip_type: "Standard",
				county_fips: "06085",
				county_name: "Santa Clara",
				carrier_route: "C909",
				congressional_district: "18",
				rdi: "Commercial",
				elot_sequence: "0031",
				elot_sort: "A",
				latitude: 37.42301,
				longitude: -122.08398,
				precision: "Zip9",
				time_zone: "Pacific",
				utc_offset: -8,
				dst: true,
			},
			analysis: {
				dpv_match_code: "Y",
				dpv_footnotes: "AABB",
				dpv_cmra: "N",
				dpv_vacant: "N",
				active: "Y",
			},
		},
	];

	describe("validateAddress", () => {
		it("returns VALID status for a confirmed address", async () => {
			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => mockValidSmartyResponse,
			});

			const result = await smartyService.validateAddress("1600 Amphitheatre Pkwy, Mountain View, CA 94043");

			expect(result.status).toBe("VALID");
			expect(result.standardized.number).toBe("1600");
			expect(result.standardized.street).toBe("Amphitheatre Pkwy");
			expect(result.standardized.city).toBe("Mountain View");
			expect(result.standardized.state).toBe("CA");
			expect(result.standardized.zip).toBe("94043-1351");
			expect(result.corrections).toHaveLength(0);
		});

		it("returns UNVERIFIABLE status when no match is found", async () => {
			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => [],
			});

			const result = await smartyService.validateAddress("123 Fake Street");

			expect(result.status).toBe("UNVERIFIABLE");
			expect(result.warnings).toContain("No matching address found");
			expect(result.standardized).toEqual({});
		});

		it("returns UNVERIFIABLE status when DPV match code is N", async () => {
			const unverifiableResponse: SmartyValidationResponse = [
				{
					...mockValidSmartyResponse[0],
					analysis: {
						...mockValidSmartyResponse[0].analysis,
						dpv_match_code: "N",
					},
				},
			];

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => unverifiableResponse,
			});

			const result = await smartyService.validateAddress("123 Main St");

			expect(result.status).toBe("UNVERIFIABLE");
			expect(result.warnings).toContain("Address could not be confirmed by USPS");
		});

		it("returns CORRECTED status when secondary number is missing", async () => {
			const missingSecondaryResponse: SmartyValidationResponse = [
				{
					...mockValidSmartyResponse[0],
					analysis: {
						...mockValidSmartyResponse[0].analysis,
						dpv_match_code: "S",
					},
				},
			];

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => missingSecondaryResponse,
			});

			const result = await smartyService.validateAddress("1600 Amphitheatre Pkwy");

			expect(result.status).toBe("CORRECTED");
			expect(result.warnings).toContain("Address is missing secondary information (apt, suite, etc.)");
		});

		it("returns CORRECTED status when enhanced match is present", async () => {
			const enhancedResponse: SmartyValidationResponse = [
				{
					...mockValidSmartyResponse[0],
					analysis: {
						...mockValidSmartyResponse[0].analysis,
						enhanced_match: "enhanced",
					},
				},
			];

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => enhancedResponse,
			});

			const result = await smartyService.validateAddress("1600 Amphitheatre Pkwy");

			expect(result.status).toBe("CORRECTED");
			expect(result.corrections).toContain("Address was enhanced or corrected");
		});

		it("adds warning when address is vacant", async () => {
			const vacantResponse: SmartyValidationResponse = [
				{
					...mockValidSmartyResponse[0],
					analysis: {
						...mockValidSmartyResponse[0].analysis,
						dpv_vacant: "Y",
					},
				},
			];

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => vacantResponse,
			});

			const result = await smartyService.validateAddress("1600 Amphitheatre Pkwy");

			expect(result.warnings).toContain("Address is marked as vacant");
		});

		it("adds warning for non-standard record types", async () => {
			const firmResponse: SmartyValidationResponse = [
				{
					...mockValidSmartyResponse[0],
					metadata: {
						...mockValidSmartyResponse[0].metadata,
						record_type: "F",
					},
				},
			];

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => firmResponse,
			});

			const result = await smartyService.validateAddress("Some Firm");

			expect(result.warnings).toContain("Address record type is F");
		});

		it("throws error when API request fails", async () => {
			(global.fetch as Mock).mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				text: async () => "Invalid credentials",
			});

			await expect(smartyService.validateAddress("123 Main St")).rejects.toThrow("Smarty API error");
		});

		it("throws error when network error occurs", async () => {
			(global.fetch as Mock).mockRejectedValue(new Error("Network error"));

			await expect(smartyService.validateAddress("123 Main St")).rejects.toThrow("Network error");
		});

		it("correctly builds street address with direction components", async () => {
			const directionResponse: SmartyValidationResponse = [
				{
					...mockValidSmartyResponse[0],
					components: {
						primary_number: "100",
						street_predirection: "N",
						street_name: "Main",
						street_suffix: "St",
						street_postdirection: "E",
						city_name: "Springfield",
						state_abbreviation: "IL",
						zipcode: "62701",
					},
				},
			];

			(global.fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => directionResponse,
			});

			const result = await smartyService.validateAddress("100 N Main St E");

			expect(result.standardized.street).toBe("N Main St E");
		});
	});
});
