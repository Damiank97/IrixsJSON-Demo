export const MILEAGE_VERSION = 2;
export type RoutePreference = "shortest" | "fastest";
export type RouteCandidate = {
    meters: number;
    seconds: number;
};
export function durationSeconds(value: unknown): number | null {
    if (typeof value !== "string" || !/^\d+(?:\.\d{1,9})?s$/.test(value))
        return null;
    const seconds = Number(value.slice(0, -1));
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
export function selectRoute(routes: RouteCandidate[], preference: RoutePreference): RouteCandidate {
    if (!routes.length || routes.some(r => !Number.isFinite(r.meters) || r.meters <= 0 || !Number.isFinite(r.seconds) || r.seconds <= 0))
        throw new Error("Afstand: De routebron gaf geen volledig bruikbare routes terug.");
    // Select from all returned routes. A missing duration must never turn a
    // shortest-route request into a silent fastest/default-route fallback.
    return [...routes].sort((a, b) => preference === "shortest" ? a.meters - b.meters || a.seconds - b.seconds : a.seconds - b.seconds || a.meters - b.meters)[0];
}
export function roundKilometers(value: number, decimals: number): number {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(decimals) || decimals < 0 || decimals > 6)
        throw new Error("Ongeldige kilometers of afronding.");
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}
export function mileageTotal(single: number, roundTrip: boolean, decimals: number): number {
    // AFAS documents Retour as doubling the single trip, not routing B→A.
    return roundKilometers(single * (roundTrip ? 2 : 1), decimals);
}
export function mileageConsistent(line: {
    kilometers: number;
    roundTrip?: boolean;
    outboundKilometers?: number;
    kilometerDecimals?: number;
    distanceSource?: string;
    calculationVersion?: number;
    afasReferenceKilometers?: number;
}, expectedDecimals?: number): string {
    if (!Number.isFinite(line.kilometers) || line.kilometers <= 0)
        return "Vul een positief aantal kilometers in.";
    const precision = expectedDecimals ?? line.kilometerDecimals ?? 3;
    if (!Number.isInteger(precision) || precision < 0 || precision > 6)
        return "Ongeldige afronding voor deze kostensoort.";
    if (Math.abs(roundKilometers(line.kilometers, precision) - line.kilometers) > 0.0000001)
        return `Deze kostensoort staat maximaal ${precision} decimalen toe. Rond de kilometers bewust af of bereken opnieuw.`;
    if (["google", "tomtom"].includes(line.distanceSource ?? "") && line.calculationVersion !== MILEAGE_VERSION)
        return "Deze afstand gebruikt de oude routeberekening. Wijzig de regel en bereken de afstand opnieuw.";
    if (line.outboundKilometers !== undefined && (!Number.isFinite(line.outboundKilometers) || line.outboundKilometers < 0 || Math.abs(line.kilometers - mileageTotal(line.outboundKilometers, !!line.roundTrip, precision)) > 0.0000001))
        return "Het totaal past niet bij enkele reis, Retour en de gekozen afronding. Bereken de afstand opnieuw.";
    if (line.afasReferenceKilometers !== undefined && (!Number.isFinite(line.afasReferenceKilometers) || line.afasReferenceKilometers <= 0 || Math.abs(line.afasReferenceKilometers - line.kilometers) > 0.0000001))
        return "De kilometers wijken af van de ingevoerde AFAS-referentie. Controleer de instellingen vóór indienen.";
    return "";
}
