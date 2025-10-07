import type { StandardizedAddress, ValidationStatus } from "@/api/address/addressModel";
import { env } from "@/common/utils/envConfig";
import { logger } from "@/server";

interface GoogleAddressComponent {
	componentName: {
		text: string;
		languageCode: string;
	};
	componentType: string;
	confirmationLevel: "CONFIRMED" | "UNCONFIRMED_BUT_PLAUSIBLE" | "UNCONFIRMED_AND_SUSPICIOUS";
}

interface GoogleVerdict {
	inputGranularity: string;
	validationGranularity: string;
	geocodeGranularity: string;
	addressComplete: boolean;
	hasUnconfirmedComponents: boolean;
	hasInferredComponents: boolean;
	hasReplacedComponents: boolean;
}

interface GoogleAddress {
	formattedAddress: string;
	postalAddress: {
		regionCode: string;
		languageCode: string;
		postalCode: string;
		administrativeArea: string;
		locality: string;
		addressLines: string[];
	};
	addressComponents: GoogleAddressComponent[];
}

interface GoogleValidationResult {
	verdict: GoogleVerdict;
	address: GoogleAddress;
}

export interface GoogleValidationResponse {
	result: GoogleValidationResult;
}

export interface GoogleServiceResult {
	standardized: StandardizedAddress;
	status: ValidationStatus;
	corrections: string[];
	warnings: string[];
}

export class GoogleService {
	private readonly apiKey: string;
	private readonly apiUrl = "https://addressvalidation.googleapis.com/v1:validateAddress";

	constructor() {
		this.apiKey = env.GOOGLE_API_KEY;
	}

	async validateAddress(address: string): Promise<GoogleServiceResult> {
		if (this.apiKey.startsWith("test-")) {
			throw new Error("Google API key not configured properly. Please set GOOGLE_API_KEY environment variable.");
		}

		try {
			const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					address: {
						regionCode: "US",
						addressLines: [address],
					},
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Google API error: ${response.status} ${response.statusText} - ${errorText}`);
			}

			const data = (await response.json()) as GoogleValidationResponse;
			return this.parseGoogleResponse(data);
		} catch (error) {
			logger.error(`Google service error: ${(error as Error).message}`);
			throw error;
		}
	}

	private parseGoogleResponse(response: GoogleValidationResponse): GoogleServiceResult {
		const { verdict, address } = response.result;
		const corrections: string[] = [];
		const warnings: string[] = [];
		let status: ValidationStatus = "VALID";

		if (address.postalAddress.regionCode && address.postalAddress.regionCode !== "US") {
			status = "UNVERIFIABLE";
			warnings.push(`Non-US address detected (${address.postalAddress.regionCode}). Only US addresses are supported.`);
		}

		if (!verdict.addressComplete) {
			status = "UNVERIFIABLE";
			warnings.push("Address is incomplete");
		}

		if (verdict.hasReplacedComponents) {
			status = "CORRECTED";
			corrections.push("Address components were corrected or replaced");
		}

		if (verdict.hasUnconfirmedComponents) {
			const unconfirmedComponents = address.addressComponents.filter(
				(component) => component.confirmationLevel !== "CONFIRMED",
			);

			if (unconfirmedComponents.some((c) => c.confirmationLevel === "UNCONFIRMED_AND_SUSPICIOUS")) {
				status = "UNVERIFIABLE";
				warnings.push("Address contains suspicious components");
			} else if (status === "VALID") {
				status = "CORRECTED";
				warnings.push("Address contains unconfirmed but plausible components");
			}
		}

		if (verdict.validationGranularity === "OTHER" || verdict.validationGranularity === "GRANULARITY_UNSPECIFIED") {
			status = "UNVERIFIABLE";
			warnings.push("Address validation granularity is insufficient");
		}

		const standardized = this.extractStandardizedAddress(address);

		return {
			standardized,
			status,
			corrections,
			warnings,
		};
	}

	private extractStandardizedAddress(address: GoogleAddress): StandardizedAddress {
		const components = address.addressComponents;
		const postalAddress = address.postalAddress;

		const streetNumber = components.find((c) => c.componentType === "street_number")?.componentName.text;
		const route = components.find((c) => c.componentType === "route")?.componentName.text;

		return {
			number: streetNumber,
			street: route,
			city: postalAddress.locality || undefined,
			state: postalAddress.administrativeArea || undefined,
			zip: postalAddress.postalCode || undefined,
		};
	}
}

export const googleService = new GoogleService();
