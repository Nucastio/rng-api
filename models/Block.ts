interface Block {
    direction: string;
    block: {
        type: string;
        era: string;
        id: string;
        size: {
            bytes: number;
        };
        height: number;
        slot: number;
        ancestor: string;
        issuer: {
            verificationKey: string;
            vrfVerificationKey: string;
            operationalCertificate: {
                count: number;
                sigma: string;
                kes: {
                    period: number;
                    verificationKey: string;
                };
            };
            leaderValue: {
                output: string;
                proof: string;
            };
        };
        protocol: {
            version: {
                major: number;
                minor: number;
            };
        };
    };
    tip: {
        slot: number;
        id: string;
        height: number;
    };
}

export default Block;