import { StatusCodes } from "http-status-codes";
import type { Mock } from "vitest";

import { AddressService } from "@/api/address/addressService";
import type { GoogleServiceResult } from "@/common/services/googleService";
import { googleService } from "@/common/services/googleService";
import type { SmartyServiceResult } from "@/common/services/smartyService";
import { smartyService } from "@/common/services/smartyService";

vi.mock("@/common/services/googleService");
vi.mock("@/common/services/smartyService");

describe("AddressService", () => {
	let addressServiceInstance: AddressService;

	beforeEach(() => {
		addressServiceInstance = new AddressService();
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

	describe("validateAddress with explicit provider", () => {
		it("uses Google when provider is 'google'", async () => {
			// Arrange
			(googleService.validateAddress as Mock).mockResolvedValue(mockGoogleResult);

			// Act
			const result = await addressServiceInstance.validateAddress(
				"1600 Amphitheatre Parkway, Mountain View, CA",
				"google",
			);

			// Assert
			expect(googleService.validateAddress).toHaveBeenCalledWith("1600 Amphitheatre Parkway, Mountain View, CA");
			expect(smartyService.validateAddress).not.toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.responseObject?.provider).toBe("google");
			expect(result.responseObject?.status).toBe("VALID");
		});

		it("uses Smarty when provider is 'smarty'", async () => {
			// Arrange
			(smartyService.validateAddress as Mock).mockResolvedValue(mockSmartyResult);

			// Act
			const result = await addressServiceInstance.validateAddress("1600 Amphitheatre Pkwy", "smarty");

			// Assert
			expect(smartyService.validateAddress).toHaveBeenCalledWith("1600 Amphitheatre Pkwy");
			expect(googleService.validateAddress).not.toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.responseObject?.provider).toBe("smarty");
			expect(result.responseObject?.status).toBe("VALID");
		});
	});

	describe("validateAddress with automatic fallback", () => {
		it("uses Google by default when no provider is specified", async () => {
			// Arrange
			(googleService.validateAddress as Mock).mockResolvedValue(mockGoogleResult);

			// Act
			const result = await addressServiceInstance.validateAddress("1600 Amphitheatre Parkway");

			// Assert
			expect(googleService.validateAddress).toHaveBeenCalledWith("1600 Amphitheatre Parkway");
			expect(smartyService.validateAddress).not.toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.responseObject?.provider).toBe("google");
		});

		it("falls back to Smarty when Google returns UNVERIFIABLE", async () => {
			// Arrange
			const unverifiableResult: GoogleServiceResult = {
				...mockGoogleResult,
				status: "UNVERIFIABLE",
			};
			(googleService.validateAddress as Mock).mockResolvedValue(unverifiableResult);
			(smartyService.validateAddress as Mock).mockResolvedValue(mockSmartyResult);

			// Act
			const result = await addressServiceInstance.validateAddress("123 Main St");

			// Assert
			expect(googleService.validateAddress).toHaveBeenCalledWith("123 Main St");
			expect(smartyService.validateAddress).toHaveBeenCalledWith("123 Main St");
			expect(result.success).toBe(true);
			expect(result.responseObject?.provider).toBe("smarty");
			expect(result.responseObject?.status).toBe("VALID");
		});

		it("returns Google UNVERIFIABLE result if Smarty fallback also fails", async () => {
			// Arrange
			const unverifiableResult: GoogleServiceResult = {
				...mockGoogleResult,
				status: "UNVERIFIABLE",
			};
			(googleService.validateAddress as Mock).mockResolvedValue(unverifiableResult);
			(smartyService.validateAddress as Mock).mockRejectedValue(new Error("Smarty API error"));

			// Act
			const result = await addressServiceInstance.validateAddress("invalid address");

			// Assert
			expect(googleService.validateAddress).toHaveBeenCalled();
			expect(smartyService.validateAddress).toHaveBeenCalled();
			expect(result.success).toBe(true);
			expect(result.responseObject?.provider).toBe("google");
			expect(result.responseObject?.status).toBe("UNVERIFIABLE");
		});

		it("falls back to Smarty when Google throws an error", async () => {
			// Arrange
			(googleService.validateAddress as Mock).mockRejectedValue(new Error("Google API error"));
			(smartyService.validateAddress as Mock).mockResolvedValue(mockSmartyResult);

			// Act
			const result = await addressServiceInstance.validateAddress("123 Main St");

			// Assert
			expect(googleService.validateAddress).toHaveBeenCalledWith("123 Main St");
			expect(smartyService.validateAddress).toHaveBeenCalledWith("123 Main St");
			expect(result.success).toBe(true);
			expect(result.responseObject?.provider).toBe("smarty");
		});

		it("returns error when both providers fail", async () => {
			// Arrange
			(googleService.validateAddress as Mock).mockRejectedValue(new Error("Google failed"));
			(smartyService.validateAddress as Mock).mockRejectedValue(new Error("Smarty failed"));

			// Act
			const result = await addressServiceInstance.validateAddress("bad address");

			// Assert
			expect(result.success).toBe(false);
			expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
			expect(result.message).toBe("An error occurred while validating the address.");
		});
	});

	describe("validateAddress response format", () => {
		it("returns properly formatted response with all required fields", async () => {
			// Arrange
			const correctedResult: GoogleServiceResult = {
				standardized: {
					number: "1600",
					street: "1600 Amphitheatre Parkway",
					city: "Mountain View",
					state: "CA",
					zip: "94043",
				},
				status: "CORRECTED",
				corrections: ["Address was standardized"],
				warnings: ["Minor formatting changes"],
			};
			(googleService.validateAddress as Mock).mockResolvedValue(correctedResult);

			// Act
			const result = await addressServiceInstance.validateAddress("1600 Amphitheatre Pkwy", "google");

			// Assert
			expect(result.success).toBe(true);
			expect(result.statusCode).toBe(StatusCodes.OK);
			expect(result.responseObject).toMatchObject({
				input: "1600 Amphitheatre Pkwy",
				standardized: correctedResult.standardized,
				status: "CORRECTED",
				corrections: ["Address was standardized"],
				provider: "google",
				warnings: ["Minor formatting changes"],
			});
		});
	});
});
