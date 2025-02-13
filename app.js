// ---------------------------
// Together & GROQ API 설정 (실제 값으로 대체)
// ---------------------------
const TOGETHER_API_KEY = "";
const GROQ_API_KEY = "";
const TOGETHER_API_ENDPOINT = "";
const GROQ_API_ENDPOINT = "";

// ---------------------------
// Supabase 설정 (실제 값으로 대체)
// ---------------------------
const supabaseUrl = "";
const supabaseAnonKey = "";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------
// Supabase에 이미지 업로드 함수 (버킷 파라미터 추가)
async function uploadImageToSupabase(file, folder) {
  // 고유 파일 이름 생성 (타임스탬프 사용)
  const fileName = `${folder}/${Date.now()}_${file.name}`;
  const { data, error } = await supabaseClient.storage
    .from("my-bucket") // 단일 버킷 이름
    .upload(fileName, file);
  if (error) {
    throw error;
  }
  const { data: urlData, error: urlError } = supabaseClient.storage
    .from("my-bucket")
    .getPublicUrl(fileName);
  if (urlError) {
    throw urlError;
  }
  return urlData.publicUrl;
}

// ---------------------------
// 이미지 업로드 및 API 호출
// ---------------------------
document.getElementById("submitBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("imageInput");
  const resultDiv = document.getElementById("result");

  if (fileInput.files.length === 0) {
    alert("이미지를 선택해주세요.");
    return;
  }

  // API 선택 (기본 Together API)
  const apiSelector = document.getElementById("apiSelector");
  const selectedApi = apiSelector ? apiSelector.value : "together";
  const apiEndpoint =
    selectedApi === "groq" ? GROQ_API_ENDPOINT : TOGETHER_API_ENDPOINT;
  const apiKey = selectedApi === "groq" ? GROQ_API_KEY : TOGETHER_API_KEY;

  // 버킷 선택: Together -> "my-bucket/supaTogether", GROQ -> "llama-bucket/supaGROQ"
  const bucket =
    selectedApi === "groq" ? "llama-bucket/supaGROQ" : "my-bucket/supaTogether";

  const file = fileInput.files[0];
  resultDiv.innerText = "이미지 업로드 중입니다...";

  try {
    // 1. Supabase에 이미지 업로드 후 public URL 얻기
    const imageUrl = await uploadImageToSupabase(file, bucket);
    console.log("업로드된 이미지 URL:", imageUrl);

    resultDiv.innerText = `이미지 업로드 완료!\n\n${
      selectedApi === "groq" ? "GROQ" : "Together"
    } API 처리 중입니다...`;

    // 2. API에 전달할 메시지 구성
    // (이미지 URL을 마크다운 이미지 태그 형식으로 전달)
    const messages = [
      {
        role: "user",
        content:
          "다음은 이미지입니다:\n\n" +
          "![](" +
          imageUrl +
          ")\n\n" +
          "이 이미지를 참고하여 해당 동물의 종류와 대략적인 무게를 알려주세요. 결과값 형식만 응답 해주세요" +
          "결과값 형식: {species : 강아지, weight : 15kg}",
      },
    ];

    // 3. 선택된 API에 따라 requestBody 결정
    // Together API: meta-llama/Llama-Vision-Free 모델 사용
    // GROQ API: meta-llama/llama-3.2-90b-vision-preview 모델 사용 (requestBody2)
    let requestBody;
    if (selectedApi === "groq") {
      // requestBody2
      requestBody = {
        model: "llama-3.2-90b-vision-preview",
        messages: messages,
        max_tokens: 512,
        temperature: 0.7,
        stop: ["<|eot|>", "<|eom_id|>"],
        stream: false,
      };
    } else {
      // 기존 requestBody
      requestBody = {
        model: "meta-llama/Llama-Vision-Free",
        messages: messages,
        max_tokens: 512,
        temperature: 0.7,
        top_p: 0.7,
        top_k: 50,
        repetition_penalty: 1,
        stop: ["<|eot|>", "<|eom_id|>"],
        stream: false,
      };
    }

    // 4. 선택한 API 호출
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API 에러 응답:", errorData);
      throw new Error(
        `HTTP 에러: ${response.status} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    const output =
      data?.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
    resultDiv.innerText = output;

    // 5. 결과 문자열에서 동물 정보(종류, 무게) 추출
    const regex = /species\s*:\s*([^,}]+)[,}]\s*weight\s*:\s*([^}]+)/i;
    const match = output.match(regex);
    if (match) {
      const species = match[1].trim();
      const weight = match[2].trim();
      const animalData = { species, weight };
      console.log("추출된 동물 데이터:", animalData);
      console.log("종류 :", species);
      console.log("무게 :", weight);
    } else {
      console.log("동물 정보 추출 실패, 응답 전체:", output);
    }
  } catch (error) {
    console.error(error);
    resultDiv.innerText = "에러 발생: " + error.message;
  }
});
