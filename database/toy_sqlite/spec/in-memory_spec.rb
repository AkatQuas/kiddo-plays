describe 'database' do
  def run_script(commands)
    raw_output = nil
    IO.popen("./exe_db-in-memory", "r+") do |pipe|
      commands.each do |command|
        pipe.puts command
      end
      pipe.close_write

      # read entire output
      raw_output = pipe.gets(nil)
    end
    raw_output.split("\n")
  end

  it 'inserts and retrieves a row' do
    result = run_script([
      "insert 1 user1name person1not@exp.com",
      "select",
      ".exit",
    ])
    expect(result).to match_array([
      "db > Executed.",
      "db > (1, user1name, person1not@exp.com)",
      "Executed.",
      "db > Bye ~",
    ])
  end

  it 'prints error message when table is full' do
    script = (1..1401).map do |i|
      "insert #{i} user#{i}name person#{i}@exp.com"
    end
    script << ".exit"
    result = run_script(script)
    expect(result[-2]).to eq('db > Error: Table full.')
    expect(result[-1]).to eq('db > Bye ~')
  end

  it 'allows inserting strings that are the maximum length' do
    long_username = "a"*32
    long_email = "a"*255
    script = [
      "insert 1 #{long_username} #{long_email}",
      "select",
      ".exit",
    ]
    result = run_script(script)
    expect(result).to match_array([
      "db > Executed.",
      "db > (1, #{long_username}, #{long_email})",
      "Executed.",
      "db > Bye ~",
    ])
  end

  it 'prints error message if strings are too long' do
    long_username = "a"*33
    long_email = "a"*256
    script = [
      "insert 1 #{long_username} #{long_email}",
      "select",
      ".exit",
    ]
    result = run_script(script)
    expect(result).to match_array([
      "db > Syntax Error: input command is too long.",
      "db > Executed.",
      "db > Bye ~",
    ])
  end

  it 'prints an error message if id is negative' do
    script = [
      "insert -1 sudo foo@bar.com",
      "select",
      ".exit",
    ]
    result = run_script(script)
    expect(result).to match_array([
      "db > Syntax Error: \"id\" should not be negative.",
      "db > Executed.",
      "db > Bye ~",
    ])
  end
end