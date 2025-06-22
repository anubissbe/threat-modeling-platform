import { createSlice } from '@reduxjs/toolkit';

interface ThreatModel {
  id: string;
  name: string;
  methodology: 'STRIDE' | 'PASTA' | 'LINDDUN' | 'VAST';
  components: unknown[];
  threats: unknown[];
  mitigations: unknown[];
}

interface ThreatModelState {
  currentModel: ThreatModel | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: ThreatModelState = {
  currentModel: null,
  isLoading: false,
  error: null,
};

const threatModelSlice = createSlice({
  name: 'threatModel',
  initialState,
  reducers: {
    setCurrentModel: (state, action) => {
      state.currentModel = action.payload;
    },
  },
});

export const { setCurrentModel } = threatModelSlice.actions;
export default threatModelSlice.reducer;