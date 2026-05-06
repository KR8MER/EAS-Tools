export async function saveFile(filename, content, mime, opts = {}) {
    const blob = (content instanceof Blob) ? content : new Blob([content], { type: mime });

    if(!/eas-recording-.*/.test(filename)) {
        let random_bytes = new Uint8Array(8);
        crypto.getRandomValues(random_bytes);
        const random_suffix = Array.from(random_bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        var unique_filename = `${filename.replace(/(\.[^.]*)?$/, `_${random_suffix}$1`)}`;
    }

    else {
        var unique_filename = filename;
    }

    if (window.EASDownloads?.saveBlob) {
        await window.EASDownloads.saveBlob(blob, unique_filename, mime, opts);
        if (window.EASBridge?.send) {
            window.EASBridge.send('download:complete', { filename: unique_filename });
        }
        return;
    }

    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = unique_filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        URL.revokeObjectURL(url);
    }
}

function freezeBurstList(list) {
    return Object.freeze(list.map((item) => Object.freeze(item)));
}

const ENDEC_MODE_PROFILE_SOURCE = {
    DEFAULT: {
        label: "None (Default)/DASDEC",
        signature: { tail: "none", lead: "none", burstGapMs: 1000 },
        betweenGapMs: 1000,
        afterGapMs: 1000,
        headerBursts: [{ prefix: "", suffix: "" }, { prefix: "", suffix: "" }, { prefix: "", suffix: "" }],
        eomBursts: [{ prefix: "", suffix: "" }, { prefix: "", suffix: "" }, { prefix: "", suffix: "" }]
    },
    NWS: {
        label: "National Weather Service (Legacy/EAS.js)",
        signature: { tail: "00 00", lead: "none", burstGapMs: 1000 },
        betweenGapMs: 1000,
        afterGapMs: 1000,
        headerBursts: [{ prefix: "", suffix: "\x00\x00" }, { prefix: "", suffix: "\x00\x00" }, { prefix: "", suffix: "\x00\x00" }],
        eomBursts: [{ prefix: "", suffix: "\x00\x00" }, { prefix: "", suffix: "\x00\x00" }, { prefix: "", suffix: "\x00\x00" }]
    },
    NWS_CRS: {
        label: "National Weather Service - Console Replacement System (CRS, 1998-2016)",
        signature: { tail: "00", lead: "none", burstGapMs: 1000 },
        betweenGapMs: 1000,
        afterGapMs: 1000,
        headerBursts: [{ prefix: "", suffix: "\x00\x00\x00" }, { prefix: "", suffix: "\x00\x00\x00" }, { prefix: "", suffix: "\x00\x00\x00" }],
        eomBursts: [{ prefix: "\x00", suffix: "\x00" }, { prefix: "\x00", suffix: "\x00" }, { prefix: "\x00", suffix: "\x00" }]
    },
    NWS_BMH: {
        label: "National Weather Service - Broadcast Message Handler (BMH, 2016-present)",
        signature: { tail: "00 00 00", lead: "none", burstGapMs: 1000 },
        betweenGapMs: 1000,
        afterGapMs: 1000,
        headerBursts: [{ prefix: "", suffix: "\x00\x00\x00" }, { prefix: "", suffix: "\x00\x00\x00" }, { prefix: "", suffix: "\x00\x00\x00" }],
        eomBursts: [{ prefix: "", suffix: "\x00\x00\x00" }, { prefix: "", suffix: "\x00\x00\x00" }, { prefix: "", suffix: "\x00\x00\x00" }]
    },
    SAGE_DIGITAL_3644: {
        label: "SAGE 3644/DIGITAL",
        signature: { tail: "FF FF FF", lead: "00 on first burst", burstGapMs: 1000 },
        betweenGapMs: 1000,
        afterGapMs: 1000,
        headerBursts: [{ prefix: "\x00", suffix: "\xFF\xFF\xFF" }, { prefix: "\xAB", suffix: "\xFF\xFF\xFF" }, { prefix: "\xAB", suffix: "\xFF\xFF\xFF" }],
        eomBursts: [{ prefix: "\x00", suffix: "\xFF\xFF\xFF" }, { prefix: "", suffix: "\xFF\xFF\xFF" }, { prefix: "", suffix: "\xFF\xFF\xFF" }]
    },
    SAGE_ANALOG_1822: {
        label: "SAGE 1822/ANALOG",
        signature: { tail: "FF", lead: "none", burstGapMs: 1000 },
        betweenGapMs: 1000,
        afterGapMs: 1000,
        headerBursts: [{ prefix: "", suffix: "\xFF" }, { prefix: "", suffix: "\xFF" }, { prefix: "", suffix: "\xFF" }],
        eomBursts: [{ prefix: "", suffix: "\xFF" }, { prefix: "", suffix: "\xFF" }, { prefix: "", suffix: "\xFF" }]
    },
    TRILITHIC: {
        label: "Trilithic EASyPLUS",
        signature: { tail: "none", lead: "none", burstGapMs: 868 },
        betweenGapMs: 868,
        afterGapMs: 1118,
        relayPop: {
            enabled: false
        },
        headerBursts: [{ prefix: "", suffix: "" }, { prefix: "", suffix: "" }, { prefix: "", suffix: "" }],
        eomBursts: [{ prefix: "", suffix: "" }, { prefix: "", suffix: "" }, { prefix: "", suffix: "" }]
    },
    TRILITHIC_POP: {
        label: "Trilithic EASyPLUS with Pop",
        signature: { tail: "none", lead: "none", burstGapMs: 868 },
        betweenGapMs: 868,
        afterGapMs: 1118,
        relayPop: {
            enabled: true,
            fileStart: "assets/pop_start.wav",
            fileEnd: "assets/pop.wav"
        },
        headerBursts: [{ prefix: "", suffix: "" }, { prefix: "", suffix: "" }, { prefix: "", suffix: "" }],
        eomBursts: [{ prefix: "", suffix: "" }, { prefix: "", suffix: "" }, { prefix: "", suffix: "" }]
    },
    KR8MER_EAS_STATION_V2: {
        label: "KR8MER EAS Station V2",
        signature: { tail: "FF FF FF", lead: "AB on all bursts", burstGapMs: 1000 },
        betweenGapMs: 1000,
        afterGapMs: 1000,
        headerBursts: [{ prefix: "\xAB", suffix: "\xFF\xFF\xFF" }, { prefix: "\xAB", suffix: "\xFF\xFF\xFF" }, { prefix: "\xAB", suffix: "\xFF\xFF\xFF" }],
        eomBursts: [{ prefix: "\xAB", suffix: "\xFF\xFF\xFF" }, { prefix: "\xAB", suffix: "\xFF\xFF\xFF" }, { prefix: "\xAB", suffix: "\xFF\xFF\xFF" }]
    }
};

export const ENDEC_MODE_OPTIONS = Object.freeze(
    Object.entries(ENDEC_MODE_PROFILE_SOURCE).map(([mode, profile]) => Object.freeze({
        value: mode,
        label: profile.label
    }))
);

export const ENDEC_MODE_PROFILES = Object.freeze(
    Object.fromEntries(
        Object.entries(ENDEC_MODE_PROFILE_SOURCE).map(([mode, profile]) => {
            const frozenProfile = Object.freeze({
                signature: Object.freeze(profile.signature),
                betweenGapMs: profile.betweenGapMs,
                afterGapMs: profile.afterGapMs,
                relayPop: profile.relayPop ? Object.freeze({ ...profile.relayPop }) : null,
                headerBursts: freezeBurstList(profile.headerBursts),
                eomBursts: freezeBurstList(profile.eomBursts)
            });
            return [mode, frozenProfile];
        })
    )
);

export const ENDEC_MODES = Object.freeze(Object.keys(ENDEC_MODE_PROFILES));

export const ENDEC_MODE_SIGNATURES = Object.freeze(
    Object.fromEntries(
        ENDEC_MODES.map((mode) => [mode, ENDEC_MODE_PROFILES[mode].signature])
    )
);

export function normalizeEndecMode(mode) {
    const value = (typeof mode === "string") ? mode.trim().toUpperCase() : "DEFAULT";
    return ENDEC_MODE_PROFILES[value] ? value : "DEFAULT";
}

export function getEndecModeProfile(mode) {
    return ENDEC_MODE_PROFILES[normalizeEndecMode(mode)];
}

export function createEndecModeVotes(initialValue = 0) {
    const votes = {};
    for (let i = 0; i < ENDEC_MODES.length; i++) {
        votes[ENDEC_MODES[i]] = initialValue;
    }
    return votes;
}

export function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export const CODEMIRROR_LIGHT_THEME_NAME = "elegant";
export const CODEMIRROR_DARK_THEME_NAME = "dracula";

export const USES_DARK_THEME = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? true : false;
