-- ============================================
-- 회원가입 시 한글 랜덤 닉네임 자동 생성
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  adjectives text[] := ARRAY[
    '빛나는','용감한','현명한','행운의','날렵한','든든한',
    '재빠른','슬기로운','당당한','활기찬','꾸준한','씩씩한',
    '영리한','담대한','부지런한','신중한','멋진','빠른',
    '똑똑한','차분한','대담한','지혜로운','열정의','냉철한'
  ];
  animals text[] := ARRAY[
    '호랑이','독수리','돌고래','사자','늑대','매',
    '용','표범','불사조','고래','곰','여우',
    '판다','코끼리','올빼미','치타','수달','펭귄',
    '해달','기린','코브라','상어','까마귀','학'
  ];
  random_name text;
  provided_name text;
BEGIN
  provided_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name'
  );

  -- 닉네임이 없거나 이메일 앞부분이면 랜덤 한글 닉네임 생성
  IF provided_name IS NULL OR provided_name = '' OR provided_name = split_part(NEW.email, '@', 1) THEN
    random_name := adjectives[1 + floor(random() * array_length(adjectives, 1))::int]
      || animals[1 + floor(random() * array_length(animals, 1))::int]
      || floor(random() * 100)::text;
  ELSE
    random_name := provided_name;
  END IF;

  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    random_name,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
