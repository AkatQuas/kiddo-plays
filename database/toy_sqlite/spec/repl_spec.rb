describe 'database' do
  def run_script(commands)
    raw_output = nil
    IO.popen("./exe_db-repl", "r+") do |pipe|
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
      "insert",
      "select",
      ".tables",
      ".exit",
    ])
    expect(result).to match_array([
      "db > Unrecognized command 'insert' .",
      "db > Unrecognized command 'select' .",
      "db > Unrecognized command '.tables' .",
      "db > Bye ~",
    ])
  end
end
