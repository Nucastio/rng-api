interface Block {
  block: {
    issuer: {
      leaderValue: {
        output: string;
        proof: string;
      };
    };
  };
}

export default Block;
