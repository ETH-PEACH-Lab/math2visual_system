export type LoadingInputs = {
  mpFormLoading: boolean;
  vlFormLoading: boolean;
  uploadGenerating: boolean;
};

function getLoadingMessage(
  mpFormLoading: boolean,
  vlFormLoading: boolean,
  uploadGenerating: boolean
) {
  if (mpFormLoading) return "Generating...";
  if (vlFormLoading || uploadGenerating) return "Regenerating...";
  return "";
}

export const useLoadingStates = ({
  mpFormLoading,
  vlFormLoading,
  uploadGenerating,
}: LoadingInputs) => {
  const isAnyLoading = mpFormLoading || vlFormLoading || uploadGenerating;
  const showAbortButton = mpFormLoading || vlFormLoading;
  const loadingMessage = getLoadingMessage(
    mpFormLoading,
    vlFormLoading,
    uploadGenerating
  );

  return {
    isAnyLoading,
    showAbortButton,
    loadingMessage,
  };
};


