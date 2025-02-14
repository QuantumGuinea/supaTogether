document.addEventListener("DOMContentLoaded", async () => {
  const apiKey = "";

  // ------------------------ 이미지 분석
  async function analyzeImage(base64Image) {
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [
              {
                type: "LABEL_DETECTION",
                maxResults: 10,
              },
            ],
          },
        ],
      }),
    });

    const result = await response.json();
    const descriptions = result.responses[0].labelAnnotations.map(
      (item) => item.description
    );
    return descriptions;
  }

  // ------------------------ 받아온 라벨(10개)를 gemini를 통해 동물과 동물의 종만 뽑아주는 프롬프트
  async function findAnimal(testSet) {
    const GEMINI_API_KEY = "AIzaSyChVDKhDWbGbDXLbp8PqdB5LKg5khQdtN4";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    // 객체를 받아와서

    const formmatText = Array.isArray(testSet) ? testSet.join(", ") : testSet;

    const prompt = `You have a dataset called ${formmatText} that contains a list of words related to animals. Your task is to extract only two specific types of words:

1. **Common Animal Names**: General names of animals (e.g., "dog," "cat," "rabbit").
2. **Animal Breeds/Species**: Specific breeds or species (e.g., "Siberian Husky," "Malamute," "Siamese Cat").

### **Exclusion Criteria**
- Do **not** include general animal-related terms (e.g., "fur," "paw," "bark").
- Do **not** include mythical or fictional creatures (e.g., "dragon," "unicorn").

### **Output Format**
Return only the extracted words **without any additional text**. The output should be structured as follows:

- First line: A comma-separated list of common animal names.
- Second line: A comma-separated list of animal breeds or species.

Make sure that the output **only** contains these lists without any extra text or formatting.`;

    const choose = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const result = await choose.json();
    console.log(result);

    const text1 = result.candidates[0].content.parts[0].text;
    console.log(`text1: ${text1}`);

    // 두 개의 줄로 나누기
    const lines = text1.split("\n"); // 개행 문자 기준으로 나누기
    const animalNames = lines[0] ? lines[0].split(",") : []; // 첫 번째 줄 → 일반 동물 이름 리스트
    const animalBreeds = lines[1] ? lines[1].split(",") : []; // 두 번째 줄 → 품종 리스트

    return { animalNames, animalBreeds }; // 두 개의 리스트를 객체로 반환
  }

  // --------------------  폼 입력 후 API 실행하는 파트 ------------------------
  const form = document.querySelector("#controller");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    //초기화
    const imgBox = document.querySelector("#showImg");
    const content = document.querySelector("#result");
    content.innerHTML = "";
    imgBox.src = "";
    imgBox.style.display = "none";

    const input = document.querySelector("#imageInput");

    // input 받아서 표시
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onloadend = async () => {
        // base64로 변환
        const base64Image = reader.result;
        imgBox.src = base64Image;
        imgBox.style.display = "block";

        try {
          const result = await analyzeImage(base64Image.split(",")[1]);
          console.log(result);

          const { animalNames, animalBreeds } = await findAnimal(result); // 두 개의 리스트를 받아옴
          console.log("Animal Names:", animalNames);
          console.log("Animal Breeds:", animalBreeds);

          if (!animalNames.length) {
            content.innerHTML += `<br><strong>당신의 동물을 파악하지 못했습니다.</strong>`;
          } else {
            content.innerHTML += `<br>당신의 동물은 <strong>${animalNames.join(
              ", "
            )}</strong>입니다.`;
          }

          if (!animalBreeds.length) {
            content.innerHTML += `<br>당신의 동물의 종은 <strong>파악하지 못했습니다.</strong>`;
          } else {
            content.innerHTML += `<br>당신의 동물의 종은 <strong>${animalBreeds.join(
              ", "
            )}</strong>입니다.`;
          }
        } catch (error) {
          console.error("Error processing image:", error);
          content.innerText = "Error processing image.";
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert("이미지 다시");
    }
  });
});
