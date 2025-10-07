import { StatusCodes } from "http-status-codes";
import request from "supertest";
import type { Mock } from "vitest";

import type { AddressValidationResponse } from "@/api/address/addressModel";
import type { ServiceResponse } from "@/common/models/serviceResponse";
import type { GoogleServiceResult } from "@/common/services/googleService";
import { googleService } from "@/common/services/googleService";
import type { SmartyServiceResult } from "@/common/services/smartyService";
import { smartyService } from "@/common/services/smartyService";
import { app } from "@/server";

vi.mock("@/common/services/googleService");
vi.mock("@/common/services/smartyService");

describe("Address Validation API Endpoints", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const mockGoogleResult: GoogleServiceResult = {
		standardized: {
			number: "1600",
			street: "1600 Amphitheatre Parkway",
			city: "Mountain View",
			state: "CA",
			zip: "94043",
		},
		status: "VALID",
		corrections: [],
		warnings: [],
	};

	const mockSmartyResult: SmartyServiceResult = {
		standardized: {
			number: "1600",
			street: "1600 Amphitheatre Pkwy",
			city: "Mountain View",
			state: "CA",
			zip: "94043-1351",
		},
		status: "VALID",
		corrections: [],
		warnings: [],
	};

	describe("POST /validate-address", () => {
		it("should validate address successfully with Google provider", async () => {
			// Arrange
			(googleService.validateAddress as Mock).mockResolvedValue(mockGoogleResult);

			// Act
			const response = await request(app).post("/validate-address").send({
				address: "1600 Amphitheatre Parkway, Mountain View, CA 94043",
				provider: "google",
			});

			const responseBody: ServiceResponse<AddressValidationResponse> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.message).toContain("Address validated successfully");
			expect(responseBody.responseObject).toMatchObject({
				input: "1600 Amphitheatre Parkway, Mountain View, CA 94043",
				standardized: mockGoogleResult.standardized,
				status: "VALID",
				provider: "google",
			});
		});

		it("should validate address successfully with Smarty provider", async () => {
			// Arrange
			(smartyService.validateAddress as Mock).mockResolvedValue(mockSmartyResult);

			// Act
			const response = await request(app).post("/validate-address").send({
				address: "1600 Amphitheatre Pkwy, Mountain View, CA 94043",
				provider: "smarty",
			});

			const responseBody: ServiceResponse<AddressValidationResponse> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.responseObject?.provider).toBe("smarty");
			expect(responseBody.responseObject?.status).toBe("VALID");
		});

		it("should use Google by default when no provider is specified", async () => {
			// Arrange
			(googleService.validateAddress as Mock).mockResolvedValue(mockGoogleResult);

			// Act
			const response = await request(app).post("/validate-address").send({
				address: "1600 Amphitheatre Parkway, Mountain View, CA",
			});

			const responseBody: ServiceResponse<AddressValidationResponse> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(googleService.validateAddress).toHaveBeenCalled();
			expect(responseBody.responseObject?.provider).toBe("google");
		});

		it("should return CORRECTED status when address is corrected", async () => {
			// Arrange
			const correctedResult: GoogleServiceResult = {
				...mockGoogleResult,
				status: "CORRECTED",
				corrections: ["Address components were corrected or replaced"],
			};
			(googleService.validateAddress as Mock).mockResolvedValue(correctedResult);

			// Act
			const response = await request(app).post("/validate-address").send({
				address: "1600 Amphitheatre Pkwy, Mtn View, CA",
				provider: "google",
			});

			const responseBody: ServiceResponse<AddressValidationResponse> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.responseObject?.status).toBe("CORRECTED");
			expect(responseBody.responseObject?.corrections).toContain("Address components were corrected or replaced");
		});

		it("should return UNVERIFIABLE status for invalid addresses", async () => {
			// Arrange
			const unverifiableResult: GoogleServiceResult = {
				standardized: {},
				status: "UNVERIFIABLE",
				corrections: [],
				warnings: ["Address is incomplete"],
			};
			(googleService.validateAddress as Mock).mockResolvedValue(unverifiableResult);

			// Act
			const response = await request(app).post("/validate-address").send({
				address: "123 Fake St",
				provider: "google",
			});

			const responseBody: ServiceResponse<AddressValidationResponse> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.responseObject?.status).toBe("UNVERIFIABLE");
		});

		it("should return bad request when address is missing", async () => {
			// Act
			const response = await request(app).post("/validate-address").send({
				provider: "google",
			});

			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("Invalid input");
		});

		it("should return bad request when address is empty", async () => {
			// Act
			const response = await request(app).post("/validate-address").send({
				address: "",
				provider: "google",
			});

			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("Invalid input");
		});

		it("should return bad request for invalid provider", async () => {
			// Act
			const response = await request(app).post("/validate-address").send({
				address: "123 Main St",
				provider: "invalid_provider",
			});

			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("Invalid input");
		});

		it("should handle service errors gracefully", async () => {
			// Arrange
			(googleService.validateAddress as Mock).mockRejectedValue(new Error("API error"));
			(smartyService.validateAddress as Mock).mockRejectedValue(new Error("API error"));

			// Act
			const response = await request(app).post("/validate-address").send({
				address: "123 Main St",
			});

			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("An error occurred while validating the address");
		});
	});
});
