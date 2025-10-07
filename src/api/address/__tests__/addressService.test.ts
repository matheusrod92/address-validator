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
			expect(result.provider).toBe("google");
			expect(result.status).toBe("VALID");
			expect(result.input).toBe("1600 Amphitheatre Parkway, Mountain View, CA");
		});

		it("uses Smarty when provider is 'smarty'", async () => {
			// Arrange
			(smartyService.validateAddress as Mock).mockResolvedValue(mockSmartyResult);

			// Act
			const result = await addressServiceInstance.validateAddress("1600 Amphitheatre Pkwy", "smarty");

			// Assert
			expect(smartyService.validateAddress).toHaveBeenCalledWith("1600 Amphitheatre Pkwy");
			expect(googleService.validateAddress).not.toHaveBeenCalled();
			expect(result.provider).toBe("smarty");
			expect(result.status).toBe("VALID");
			expect(result.input).toBe("1600 Amphitheatre Pkwy");
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
			expect(result.provider).toBe("google");
			expect(result.status).toBe("VALID");
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
			expect(result.provider).toBe("smarty");
			expect(result.status).toBe("VALID");
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
			expect(result.provider).toBe("google");
			expect(result.status).toBe("UNVERIFIABLE");
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
			expect(result.provider).toBe("smarty");
			expect(result.status).toBe("VALID");
		});

		it("throws error when both providers fail", async () => {
			// Arrange
			(googleService.validateAddress as Mock).mockRejectedValue(new Error("Google failed"));
			(smartyService.validateAddress as Mock).mockRejectedValue(new Error("Smarty failed"));

			// Act & Assert
			await expect(addressServiceInstance.validateAddress("bad address")).rejects.toThrow(
				"Both providers failed - Google: Google failed, Smarty: Smarty failed",
			);
		});
	});

	describe("validateAddress response format", () => {
		it("returns properly formatted response with all required fields", async () => {
			// Arrange
			const correctedResult: GoogleServiceResult = {
				standardized: {
					number: "1600",
					street: "Amphitheatre Parkway",
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
			expect(result).toMatchObject({
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
