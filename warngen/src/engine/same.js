/* eslint-disable */
/*
 * SAME (Specific Area Message Encoding) header generation for WarnGen.
 *
 * Produces a ZCZC-prefixed header string corresponding to the bulletin
 * currently rendered by WarnGen. WarnGen always issues NWS Weather Forecast
 * Office (WFO) products, so the originator (ORG) is always "WXR".
 *
 * Header format reference (NWS NWSI 10-1712 / FCC 47 CFR 11.31):
 *   ZCZC-ORG-EEE-PSSCCC-PSSCCC...+TTTT-JJJHHMM-LLLLLLLL-
 */
(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.WarngenSAME = factory();
    }
}(typeof self !== "undefined" ? self : this, function () {

    // WarnGen productId -> SAME event code (EEE).
    // The product IDs used internally in WarnGen happen to match the SAME
    // event codes for these products, but be explicit to avoid surprises.
    var EVENT_CODES = {
        TOR: "TOR", // Tornado Warning
        SVR: "SVR", // Severe Thunderstorm Warning
        FFW: "FFW", // Flash Flood Warning
        EWW: "EWW", // Extreme Wind Warning
        SPS: "SPS"  // Special Weather Statement
    };

    // State abbreviation -> two-digit FIPS state code, used as a fallback when
    // the impacted-area record does not carry an explicit state_fips field.
    var STATE_FIPS = {
        AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
        DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
        IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
        MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
        NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
        OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
        TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
        WI: "55", WY: "56", AS: "60", GU: "66", MP: "69", PR: "72", VI: "78"
    };

    function pad2(n) { return n < 10 ? "0" + n : "" + n; }
    function pad3(n) {
        if (n < 10) return "00" + n;
        if (n < 100) return "0" + n;
        return "" + n;
    }

    function eventCode(productId) {
        var key = String(productId || "").toUpperCase();
        return EVENT_CODES[key] || key.slice(0, 3) || "RWT";
    }

    // Pull a 2-digit state FIPS out of an impacted-area record. The polygon
    // hits coming from doRender() carry only the 3-digit county portion in
    // .fips, but the underlying GeoJSON properties include the full 5-digit
    // FIPS via state_fips/full fips, so accept any of those shapes here.
    function stateFipsFor(area) {
        if (!area) return null;
        if (area.state_fips && /^\d{2}$/.test(String(area.state_fips))) {
            return String(area.state_fips);
        }
        var raw = area.rawFips || area.fullFips || area.fips5 || area.geoid;
        if (raw && /^\d{5}$/.test(String(raw))) {
            return String(raw).slice(0, 2);
        }
        var st = (area.state || area.stateabbr || "").toUpperCase();
        if (STATE_FIPS[st]) return STATE_FIPS[st];
        return null;
    }

    // Returns a 6-digit PSSCCC location code, or null if we cannot derive it.
    // P = 0 indicates the entire county is affected (WarnGen does not split
    // by sub-county subdivision in its SAME output today).
    function locationCode(area) {
        var sFips = stateFipsFor(area);
        if (!sFips) return null;
        var countyFips = String(area.fips || area.state_zone || "");
        // .fips may be 5-digit (full GEOID) or 3-digit (county-only).
        if (countyFips.length >= 5) countyFips = countyFips.slice(-3);
        if (!/^\d{1,3}$/.test(countyFips)) return null;
        return "0" + sFips + pad3(parseInt(countyFips, 10));
    }

    // Produce a unique, order-preserving list of PSSCCC codes from the
    // impacted areas array.
    function locationCodes(areas) {
        var codes = [];
        var seen = {};
        if (!areas) return codes;
        for (var i = 0; i < areas.length; i++) {
            var c = locationCode(areas[i]);
            if (!c) continue;
            if (seen[c]) continue;
            seen[c] = true;
            codes.push(c);
        }
        return codes;
    }

    // Format the purge interval (+TTTT). Per the SAME spec, when the duration
    // is less than one hour it is reported in minutes rounded to the nearest
    // 15 minutes; for longer durations it is reported in whole hours rounded
    // to the nearest 30 minutes (max 99 hours 30 minutes).
    function purgeTime(durationMinutes) {
        var d = Math.max(0, parseInt(durationMinutes, 10) || 0);
        var hh, mm;
        if (d < 60) {
            mm = Math.round(d / 15) * 15;
            if (mm < 15) mm = 15;
            hh = 0;
        } else {
            var totalHalfHours = Math.round(d / 30);
            if (totalHalfHours > 199) totalHalfHours = 199;
            hh = Math.floor(totalHalfHours / 2);
            mm = (totalHalfHours % 2) * 30;
            if (hh > 99) { hh = 99; mm = 30; }
        }
        return "+" + pad2(hh) + pad2(mm);
    }

    // Day-of-year (1..366) in UTC for the given Date.
    function dayOfYearUTC(d) {
        var start = Date.UTC(d.getUTCFullYear(), 0, 1);
        var diff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
            - start;
        return Math.floor(diff / 86400000) + 1;
    }

    function issueTime(date) {
        var doy = dayOfYearUTC(date);
        return pad3(doy) + pad2(date.getUTCHours()) + pad2(date.getUTCMinutes());
    }

    // 8-character station/sender ID. NWS WFOs use "<ICAO>/NWS" (e.g.
    // "KOAX/NWS"). vtecOffice from getOfficeMeta() is the 4-letter ICAO.
    function senderId(vtecOffice) {
        var icao = String(vtecOffice || "").toUpperCase().slice(0, 4);
        if (icao.length < 4) {
            // Pad on the right with hyphens to keep the field 8 chars wide
            // and clearly indicate an unknown office.
            while (icao.length < 4) icao += "-";
        }
        return icao + "/NWS";
    }

    function build(opts) {
        opts = opts || {};
        var locs = locationCodes(opts.areas);
        if (locs.length === 0) return null;

        var issuedDate = opts.issuedDate instanceof Date
            ? opts.issuedDate
            : new Date(opts.issuedDate || Date.now());
        if (isNaN(issuedDate.getTime())) issuedDate = new Date();

        var ee = eventCode(opts.productId);
        var ttt = purgeTime(opts.durationMinutes);
        var jjj = issueTime(issuedDate);
        var lll = senderId(opts.vtecOffice);

        return "ZCZC-WXR-" + ee + "-" + locs.join("-") + ttt
            + "-" + jjj + "-" + lll + "-";
    }

    return {
        build:          build,
        eventCode:      eventCode,
        locationCode:   locationCode,
        locationCodes:  locationCodes,
        purgeTime:      purgeTime,
        issueTime:      issueTime,
        senderId:       senderId,
        stateFipsFor:   stateFipsFor,
        STATE_FIPS:     STATE_FIPS,
        EVENT_CODES:    EVENT_CODES
    };
}));
