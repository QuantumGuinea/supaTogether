// ---------------------------
// Together API 설정 (실제 값으로 대체)
// ---------------------------

// 📌 API_ENDPOINT 는 그대로 두셔도 무방합니다.
const API_KEY = "";
const API_ENDPOINT = "https://api.together.xyz/v1/chat/completions";

// ---------------------------
// Supabase 설정 (실제 값으로 대체)
// ---------------------------

// 📌 반드시 Supabase URL과 AnonKey가 있어야 합니다.
const supabaseUrl = "";
const supabaseAnonKey =
  "";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------
// Supabase에 이미지 업로드 함수
// ---------------------------
async function uploadImageToSupabase(file) {
  // 고유 파일 이름 생성 (타임스탬프 사용)
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabaseClient.storage
    .from("my-bucket/supaTogether")
    .upload(fileName, file);
  if (error) {
    throw error;
  }
  // Supabase v2의 경우 getPublicUrl은 동기적으로 반환하며, 반환 객체의 프로퍼티 이름은 "publicUrl"입니다.
  const { data: urlData, error: urlError } = supabaseClient.storage
    .from("my-bucket/supaTogether")
    .getPublicUrl(fileName);
  if (urlError) {
    throw urlError;
  }
  return urlData.publicUrl;
}

// ---------------------------
// 이미지 업로드 및 Together API 호출
// ---------------------------
document.getElementById("submitBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("imageInput");
  const resultDiv = document.getElementById("result");

  if (fileInput.files.length === 0) {
    alert("이미지를 선택해주세요.");
    return;
  }

  const file = fileInput.files[0];
  resultDiv.innerText = "이미지 업로드 중입니다...";

  try {
    // 1. Supabase에 이미지 업로드 후 public URL 얻기
    const imageUrl = await uploadImageToSupabase(file);
    // 콘솔에 imageUrl이 정상적으로 출력 되는지 확인인
    console.log("업로드된 이미지 URL:", imageUrl);

    resultDiv.innerText =
      "이미지 업로드 완료!\n\nTogether API 처리 중입니다...";

    // 2. Together API에 전달할 메시지 구성
    // URL을 마크다운 이미지 태그 형식으로 감싸서 전달 (예: ![](URL))
    // 📌 어쩌다보니 넣게 된 조그마한 기능이라 없어도 정상적으로 작동할지는 모르겠습니다.
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

    const requestBody = {
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

    // 3. Together API 호출
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
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

    // 4. 결과 문자열에서 동물 정보(종류, 무게) 추출 및 데이터화
    // 예시 응답: "{species : 강아지, weight : 15kg}"
    // 정규표현식을 사용하여 species와 weight를 추출 by chatGPT
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
