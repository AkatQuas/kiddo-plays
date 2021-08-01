describe 'database' do
  def run_script(commands)
    raw_output = nil
    IO.popen("./exe_db-simple-command", "r+") do |pipe|
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
      ".tables",
      "insert",
      "select",
      "delete",
      ".exit",
    ])
    expect(result).to match_array([
      "db > Unrecognized command '.tables' .",
      "db > This is where we would do an insert.",
        "Executed.",
      "db > This is where we would do a select.",
        "Executed.",
      "db > Unrecognized keyword at start of 'delete' .",
      "db > Bye ~",
    ])
  end
end
